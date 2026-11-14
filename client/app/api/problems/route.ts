import { NextResponse } from "next/server";
import { z } from "zod";
import { problemSchema } from "@/lib/problems/schema";
import { getProblem, isUploaded, listProblems, saveUploadedProblem } from "@/lib/problems/store";
import { rateLimit, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { gradeAgainst } from "@/lib/server/grade";
import { RunnerError } from "@/lib/server/piston";

export async function GET() {
  return NextResponse.json({ problems: listProblems() });
}

/**
 * Upload a problem. It must match the schema AND its reference solution must
 * pass every visible and hidden test on Piston before it's published.
 * Send `{ dryRun: true, problem }` to validate without saving. Re-publishing a
 * slug you own replaces it.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (process.env.ALLOW_PROBLEM_UPLOADS === "false") {
    return NextResponse.json({ error: "Problem uploads are disabled on this server" }, { status: 403 });
  }
  if (!rateLimit(`upload:${auth.id}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }

  const raw = (await req.json().catch(() => null)) as { problem?: unknown; dryRun?: unknown } | null;
  const parsed = problemSchema.safeParse(raw?.problem);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "The problem doesn't match the required format.",
        issues: parsed.error.issues.slice(0, 20).map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }
  const problem = parsed.data;
  const dryRun = z.boolean().catch(false).parse(raw?.dryRun);

  const owner = db().prepare("SELECT owner_id FROM problem_owners WHERE slug = ?").get(problem.slug) as
    | { owner_id: string }
    | undefined;
  const mine = owner?.owner_id === auth.id && isUploaded(problem.slug);
  if (!dryRun && getProblem(problem.slug) && !mine) {
    return NextResponse.json({ error: `A problem with slug "${problem.slug}" already exists.` }, { status: 409 });
  }

  let verification;
  try {
    verification = await gradeAgainst(problem, problem.reference.language, problem.reference.code, "submit");
  } catch (e) {
    if (e instanceof RunnerError) {
      console.error("[problems]", e.message);
      const message = e.message.startsWith("Piston has no runtime")
        ? e.message
        : "Couldn't reach the code runner to verify the reference solution.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
    throw e;
  }

  // Uploader is the author, so they're allowed to see why their own hidden tests fail.
  const allPassed = !verification.compileError && verification.summary.passed === verification.summary.total;
  if (!allPassed) {
    const cases = [...problem.examples, ...problem.tests];
    return NextResponse.json(
      {
        error: "The reference solution didn't pass every test, so the problem wasn't published.",
        verification: {
          ...verification,
          results: verification.results.map((r) => ({ ...r, expected: cases[r.index]?.output })),
        },
      },
      { status: 422 },
    );
  }

  if (!dryRun) {
    saveUploadedProblem(problem);
    db()
      .prepare("INSERT INTO problem_owners (slug, owner_id, created_at) VALUES (?, ?, ?) ON CONFLICT (slug) DO NOTHING")
      .run(problem.slug, auth.id, Date.now());
  }
  return NextResponse.json({ ok: true, published: !dryRun, slug: problem.slug, verification });
}
