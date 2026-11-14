import "server-only";
import { LANGUAGES, type LanguageId } from "@/lib/languages";

/**
 * Talks to a self-hosted Piston instance (github.com/engineer-man/piston) over
 * the LAN. The browser never sees this URL.
 *
 * Piston has no batch endpoint, so each test case is its own
 * POST /api/v2/execute, run with bounded concurrency. Language versions are
 * resolved from GET /api/v2/runtimes, so whatever packages you've installed
 * are used automatically (pin one with PISTON_RUNTIMES if you have several).
 */

const PISTON_URL = (process.env.PISTON_URL ?? "http://localhost:2000").replace(/\/$/, "");
const CONCURRENCY = Math.max(1, Number(process.env.PISTON_CONCURRENCY ?? 4));
/** Must not exceed the instance's PISTON_RUN_TIMEOUT, or Piston rejects the request. */
const MAX_RUN_TIMEOUT_MS = Number(process.env.PISTON_MAX_RUN_TIMEOUT_MS ?? 3000);
const COMPILE_TIMEOUT_MS = process.env.PISTON_COMPILE_TIMEOUT_MS ? Number(process.env.PISTON_COMPILE_TIMEOUT_MS) : undefined;
const RUNTIME_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT = 32 * 1024;

export class RunnerError extends Error {}

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.PISTON_API_KEY) h.Authorization = process.env.PISTON_API_KEY;
  return h;
}

async function pistonFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${PISTON_URL}${path}`, {
      ...init,
      headers: headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    throw new RunnerError(`Can't reach Piston at ${PISTON_URL} (${(e as Error).message})`);
  }
}

// --------------------------------------------------------------- runtimes

type Runtime = { language: string; version: string; aliases: string[]; runtime?: string };
type Resolved = { language: string; version: string };

const g = globalThis as unknown as { __mockifyPistonRuntimes?: { at: number; list: Runtime[] } };

async function runtimes(): Promise<Runtime[]> {
  const c = g.__mockifyPistonRuntimes;
  if (c && Date.now() - c.at < RUNTIME_TTL_MS) return c.list;
  const res = await pistonFetch("/api/v2/runtimes");
  if (!res.ok) throw new RunnerError(`Piston /runtimes failed (${res.status})`);
  const list = (await res.json()) as Runtime[];
  g.__mockifyPistonRuntimes = { at: Date.now(), list };
  return list;
}

let pins: Partial<Record<LanguageId, string>> | null = null;
function pinned(lang: LanguageId): string | undefined {
  if (pins === null) {
    try {
      pins = JSON.parse(process.env.PISTON_RUNTIMES ?? "{}");
    } catch {
      console.error("PISTON_RUNTIMES is not valid JSON; ignoring it");
      pins = {};
    }
  }
  return pins?.[lang];
}

function compareVersions(a: string, b: string) {
  const pa = a.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

async function resolveRuntime(lang: LanguageId): Promise<Resolved> {
  const pin = pinned(lang); // "python" | "python@3.12.0" | "@3.12.0"
  const [pinName, pinVersion] = pin ? pin.split("@") : [undefined, undefined];
  const names = pinName ? [pinName] : LANGUAGES[lang].pistonNames;
  const list = await runtimes();
  // Earlier names win (so dotnet's csharp.net beats mono's csharp), then the newest version.
  let matches: Runtime[] = [];
  for (const n of names) {
    matches = list.filter(
      (r) => (r.language === n || r.aliases.includes(n)) && (!pinVersion || r.version === pinVersion),
    );
    if (matches.length) break;
  }
  if (matches.length === 0) {
    throw new RunnerError(
      `Piston has no runtime for ${LANGUAGES[lang].label}. Install one with \`cli/index.js ppman install ${names[0]}\`.`,
    );
  }
  const best = matches.sort((a, b) => compareVersions(b.version, a.version))[0];
  return { language: best.language, version: best.version };
}

// -------------------------------------------------------------- execution

export type ExecStatus =
  | "ok"
  | "compile_error"
  | "runtime_error"
  | "time_limit"
  | "memory_limit"
  | "internal_error";

export type ExecResult = {
  status: ExecStatus;
  statusText: string;
  stdout: string;
  stderr: string;
  compileOutput: string;
  timeMs: number | null;
  memoryKb: number | null;
};

export type ExecJob = { stdin: string };
export type ExecOptions = { cpuTimeSec?: number; memoryKb?: number };

type Stage = {
  stdout: string;
  stderr: string;
  output: string;
  code: number | null;
  signal: string | null;
  message?: string | null;
  /** Newer Piston: RE, SG, TO, OL (stdout too long), EL (stderr too long), XX (internal). */
  status?: string | null;
  cpu_time?: number;
  wall_time?: number;
  memory?: number;
};
type ExecuteResponse = { language: string; version: string; run: Stage; compile?: Stage; message?: string };

const clip = (s: string | null | undefined) => {
  const v = s ?? "";
  return v.length > MAX_OUTPUT ? v.slice(0, MAX_OUTPUT) + "\n… (output truncated)" : v;
};

function classify(run: Stage, timeoutMs: number): { status: ExecStatus; text: string } {
  const st = run.status ?? null;
  if (st === "TO") return { status: "time_limit", text: "Time Limit Exceeded" };
  if (st === "XX") return { status: "internal_error", text: run.message ?? "Internal Error" };
  if (st === "OL" || st === "EL") return { status: "runtime_error", text: "Output Limit Exceeded" };
  if (run.signal) {
    // Older Piston has no `status`; a SIGKILL at the time limit is a timeout.
    const timedOut =
      run.signal === "SIGKILL" &&
      (/time/i.test(run.message ?? "") || (run.wall_time ?? 0) >= timeoutMs * 0.95 || !run.message);
    if (timedOut) return { status: "time_limit", text: "Time Limit Exceeded" };
    return { status: "runtime_error", text: `Runtime Error (${run.signal})` };
  }
  if (run.code !== 0 && run.code !== null) return { status: "runtime_error", text: `Runtime Error (exit ${run.code})` };
  if (st === "RE") return { status: "runtime_error", text: run.message ?? "Runtime Error" };
  return { status: "ok", text: "Finished" };
}

async function executeOne(
  lang: LanguageId,
  rt: Resolved,
  source: string,
  stdin: string,
  timeoutMs: number,
  memoryBytes: number | undefined,
): Promise<ExecResult> {
  const res = await pistonFetch("/api/v2/execute", {
    method: "POST",
    body: JSON.stringify({
      language: rt.language,
      version: rt.version,
      files: [{ name: LANGUAGES[lang].fileName, content: source }],
      stdin,
      run_timeout: timeoutMs,
      ...(COMPILE_TIMEOUT_MS ? { compile_timeout: COMPILE_TIMEOUT_MS } : {}),
      ...(memoryBytes ? { run_memory_limit: memoryBytes } : {}),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Partial<ExecuteResponse>;
  if (!res.ok || !body.run) {
    throw new RunnerError(`Piston rejected the job (${res.status}): ${body.message ?? "no run result"}`);
  }

  const compile = body.compile;
  if (compile && (compile.code !== 0 || compile.signal || (compile.status && compile.status !== "OK"))) {
    return {
      status: "compile_error",
      statusText: "Compilation Error",
      stdout: "",
      stderr: "",
      compileOutput: clip(compile.output || compile.stderr || compile.message || "Compilation failed"),
      timeMs: null,
      memoryKb: null,
    };
  }

  const run = body.run;
  const { status, text } = classify(run, timeoutMs);
  const timeMs = run.cpu_time ?? run.wall_time ?? null;
  return {
    status,
    statusText: text,
    stdout: clip(run.stdout),
    stderr: clip(run.stderr || (status !== "ok" ? run.message : "")),
    compileOutput: "",
    timeMs: timeMs === null ? null : Math.round(timeMs),
    memoryKb: typeof run.memory === "number" ? Math.round(run.memory / 1024) : null,
  };
}

/** Runs the same source against several stdins. Results come back in order. */
export async function executeBatch(
  language: LanguageId,
  source: string,
  jobs: ExecJob[],
  opts: ExecOptions = {},
): Promise<ExecResult[]> {
  if (jobs.length === 0) return [];
  const rt = await resolveRuntime(language);
  const timeoutMs = Math.min(MAX_RUN_TIMEOUT_MS, Math.round((opts.cpuTimeSec ?? Infinity) * 1000));
  const memoryBytes = opts.memoryKb ? opts.memoryKb * 1024 : undefined;

  // Run the first job alone: if it doesn't compile, none will, so skip the rest.
  const first = await executeOne(language, rt, source, jobs[0].stdin, timeoutMs, memoryBytes);
  if (first.status === "compile_error") return jobs.map(() => first);

  const results: ExecResult[] = new Array(jobs.length);
  results[0] = first;
  let next = 1;
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++;
      results[i] = await executeOne(language, rt, source, jobs[i].stdin, timeoutMs, memoryBytes);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length - 1) }, worker));
  return results;
}

/** Whitespace-tolerant comparison: ignores trailing spaces and trailing blank lines. */
export function outputsMatch(actual: string, expected: string): boolean {
  const norm = (s: string) =>
    s
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((l) => l.trimEnd())
      .join("\n")
      .trimEnd();
  return norm(actual) === norm(expected);
}
