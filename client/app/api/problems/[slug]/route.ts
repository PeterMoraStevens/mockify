import { NextResponse } from "next/server";
import { getProblem, toInterviewer, toPublic } from "@/lib/problems/store";
import { requireUser } from "@/lib/server/auth";

/**
 * Public view by default. `?view=interviewer` adds hints, follow-ups and
 * expected complexity. Roles live in the peer-to-peer session, so the server
 * can't tell who is interviewing; the room UI only requests the interviewer
 * view for the interviewer. Hidden tests and the reference are never sent.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/problems/[slug]">) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { slug } = await ctx.params;
  const problem = getProblem(slug);
  if (!problem) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const view = new URL(req.url).searchParams.get("view");
  return NextResponse.json(view === "interviewer" ? toInterviewer(problem) : toPublic(problem));
}
