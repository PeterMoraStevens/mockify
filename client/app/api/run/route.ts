import { NextResponse } from "next/server";
import { z } from "zod";
import { LANGUAGE_IDS } from "@/lib/languages";
import { getProblem } from "@/lib/problems/store";
import { rateLimit, requireUser } from "@/lib/server/auth";
import { gradeAgainst } from "@/lib/server/grade";
import { executeBatch, RunnerError } from "@/lib/server/piston";
import type { RunResponse } from "@/lib/run-types";

const body = z.discriminatedUnion("mode", [
  z.object({
    mode: z.enum(["run", "submit"]),
    slug: z.string().max(64),
    language: z.enum(LANGUAGE_IDS),
    code: z.string().min(1).max(64 * 1024),
  }),
  z.object({
    mode: z.literal("custom"),
    slug: z.string().max(64).optional(),
    language: z.enum(LANGUAGE_IDS),
    code: z.string().min(1).max(64 * 1024),
    stdin: z.string().max(64 * 1024).default(""),
  }),
]);

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  if (!rateLimit(`run:${auth.id}`, 20, 60 * 1000)) {
    return NextResponse.json({ error: "Too many runs. Wait a few seconds." }, { status: 429 });
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const input = parsed.data;

  try {
    if (input.mode === "custom") {
      const problem = input.slug ? getProblem(input.slug) : null;
      const [r] = await executeBatch(input.language, input.code, [{ stdin: input.stdin }], {
        cpuTimeSec: problem?.limits?.cpuTimeSec,
        memoryKb: problem?.limits?.memoryKb,
      });
      const response: RunResponse = {
        mode: "custom",
        compileError: r.status === "compile_error" ? r.compileOutput || r.stderr : undefined,
        results: [],
        custom: {
          status: r.status,
          statusText: r.statusText,
          stdout: r.stdout,
          stderr: r.stderr,
          timeMs: r.timeMs,
          memoryKb: r.memoryKb,
        },
        summary: { passed: 0, total: 0 },
      };
      return NextResponse.json(response);
    }

    const problem = getProblem(input.slug);
    if (!problem) return NextResponse.json({ error: "Unknown problem" }, { status: 404 });
    return NextResponse.json(await gradeAgainst(problem, input.language, input.code, input.mode));
  } catch (e) {
    if (e instanceof RunnerError) {
      console.error("[run]", e.message);
      const message = e.message.startsWith("Piston has no runtime") ? e.message : "The code runner is unavailable right now.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
    throw e;
  }
}
