import { NextResponse } from "next/server";
import { z } from "zod";
import { LANGUAGE_IDS } from "@/lib/languages";
import { MAX_IO } from "@/lib/problems/schema";
import { rateLimit, requireUser } from "@/lib/server/auth";
import { RunnerError, executeBatch } from "@/lib/server/piston";

const body = z.object({
  language: z.enum(LANGUAGE_IDS),
  code: z.string().min(1).max(50_000),
  inputs: z.array(z.string().max(MAX_IO)).min(1).max(110),
});

/**
 * Used by the problem builder: runs the reference solution over the inputs
 * and returns what it printed, so authors don't have to work outputs out by hand.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!rateLimit(`outputs:${auth.id}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many runs. Try again in a few minutes." }, { status: 429 });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });

  try {
    const results = await executeBatch(
      parsed.data.language,
      parsed.data.code,
      parsed.data.inputs.map((stdin) => ({ stdin })),
      {},
    );
    const compile = results.find((r) => r.status === "compile_error");
    if (compile) {
      return NextResponse.json({ compileError: compile.compileOutput || compile.stderr || "Compilation failed" });
    }
    return NextResponse.json({
      results: results.map((r) => ({
        ok: r.status === "ok",
        statusText: r.statusText,
        stdout: r.stdout,
        stderr: r.stderr,
      })),
    });
  } catch (e) {
    if (e instanceof RunnerError) return NextResponse.json({ error: e.message }, { status: 502 });
    throw e;
  }
}
