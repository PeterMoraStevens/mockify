import "server-only";
import type { LanguageId } from "@/lib/languages";
import type { Problem, TestCase } from "@/lib/problems/schema";
import type { RunResponse, TestResult } from "@/lib/run-types";
import { executeBatch, outputsMatch } from "./piston";

type Labeled = TestCase & { kind: "example" | "hidden" };

/**
 * Runs `code` against the given cases and grades the output. Hidden cases are
 * reduced to pass/fail + resource usage before anything leaves the server.
 */
export async function gradeAgainst(
  problem: Pick<Problem, "examples" | "tests" | "limits">,
  language: LanguageId,
  code: string,
  mode: "run" | "submit",
): Promise<RunResponse> {
  const cases: Labeled[] = [
    ...problem.examples.map((t) => ({ ...t, kind: "example" as const })),
    ...(mode === "submit" ? problem.tests.map((t) => ({ ...t, kind: "hidden" as const })) : []),
  ];

  const exec = await executeBatch(
    language,
    code,
    cases.map((c) => ({ stdin: c.input })),
    { cpuTimeSec: problem.limits?.cpuTimeSec, memoryKb: problem.limits?.memoryKb },
  );

  const compileFail = exec.find((r) => r.status === "compile_error");
  if (compileFail) {
    return {
      mode,
      compileError: compileFail.compileOutput || compileFail.stderr || "Compilation failed",
      results: [],
      summary: { passed: 0, total: cases.length },
    };
  }

  const results: TestResult[] = exec.map((r, i) => {
    const c = cases[i];
    const passed = r.status === "ok" && outputsMatch(r.stdout, c.output);
    // Piston cuts stdout off at its PISTON_OUTPUT_MAX_SIZE (1024 chars by default).
    // If even the correct answer is longer than what it kept, that's the runner's
    // config, not the candidate's code, so say so instead of blaming them.
    if (r.statusText === "Output Limit Exceeded" && c.output.length > r.stdout.length) {
      warnOutputCap(c.output.length);
      r = { ...r, statusText: "Output Limit Exceeded (code runner limit too low)" };
    }
    const base: TestResult = {
      index: i,
      kind: c.kind,
      passed,
      status: r.status,
      statusText: passed ? "Accepted" : r.status === "ok" ? "Wrong Answer" : r.statusText,
      timeMs: r.timeMs,
      memoryKb: r.memoryKb,
    };
    if (c.kind === "hidden") {
      const kind = r.status === "runtime_error" ? errorKind(r.stderr) : null;
      return kind ? { ...base, errorKind: kind } : base;
    }
    return { ...base, input: c.input, expected: c.output, stdout: r.stdout, stderr: r.stderr };
  });

  return {
    mode,
    results,
    summary: { passed: results.filter((r) => r.passed).length, total: results.length },
  };
}

/**
 * The name of the error in a runtime error's stderr, without its message:
 * "IndexError", "java.lang.ArrayIndexOutOfBoundsException", "panic"… Safe to
 * show for hidden tests, where the full stderr could leak the hidden input.
 */
export function errorKind(stderr: string): string | null {
  // Python prints the exception last (after the traceback); most others print it first.
  const names = [...stderr.matchAll(/(?<![\w.$])((?:[A-Za-z_$][\w$]*\.)*[A-Z][\w$]*(?:Error|Exception|Exit|Interrupt|Overflow))\b/g)].map((m) => m[1]);
  if (names.length) {
    const py = /Traceback \(most recent call last\)/.test(stderr);
    return (py ? names[names.length - 1] : names[0]).slice(0, 80);
  }
  if (/\bpanic(?:ked)?\b/.test(stderr)) return "panic";
  if (/\bFatal error\b/.test(stderr)) return "Fatal error";
  if (/\bSegmentation fault\b/i.test(stderr)) return "Segmentation fault";
  if (/\bstack overflow\b/i.test(stderr)) return "Stack overflow";
  if (/\babort(?:ed)?\b/i.test(stderr)) return "Aborted";
  return null;
}

let warnedCap = false;
function warnOutputCap(needed: number) {
  if (warnedCap) return;
  warnedCap = true;
  console.warn(
    `[grade] Piston cut off a test whose expected output is ${needed} chars. ` +
      "Set PISTON_OUTPUT_MAX_SIZE=65536 on the Piston container (its default is 1024) and restart it.",
  );
}
