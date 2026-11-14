import { NextResponse } from "next/server";
import { deleteUploadedProblem, getProblem, isUploaded, toInterviewer, toPublic } from "@/lib/problems/store";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

const ownerOf = (slug: string) =>
  (db().prepare("SELECT owner_id FROM problem_owners WHERE slug = ?").get(slug) as { owner_id: string } | undefined)?.owner_id;

/**
 * Public view by default. `?view=interviewer` adds hints, follow-ups and
 * expected complexity. Roles live in the peer-to-peer session, so the server
 * can't tell who is interviewing; the room UI only requests the interviewer
 * view for the interviewer. Hidden tests and the reference are never sent,
 * except `?view=source` (the whole file) to the person who uploaded it.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/problems/[slug]">) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { slug } = await ctx.params;
  const problem = getProblem(slug);
  if (!problem) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const view = new URL(req.url).searchParams.get("view");
  if (view === "source") {
    if (ownerOf(slug) !== auth.id) return NextResponse.json({ error: "Only the author can see this" }, { status: 403 });
    return NextResponse.json(problem);
  }
  return NextResponse.json(view === "interviewer" ? toInterviewer(problem) : toPublic(problem));
}

/** Authors can delete problems they uploaded. Built-in problems can't be deleted. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/problems/[slug]">) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { slug } = await ctx.params;
  if (ownerOf(slug) !== auth.id || !isUploaded(slug)) {
    return NextResponse.json({ error: "You can only delete problems you uploaded" }, { status: 403 });
  }
  deleteUploadedProblem(slug);
  db().prepare("DELETE FROM problem_owners WHERE slug = ?").run(slug);
  return NextResponse.json({ ok: true });
}
