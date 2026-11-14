import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { MAX_DRAFT_BYTES, deleteDraft, draftBody, getDraft, updateDraft } from "@/lib/server/drafts";

export async function GET(_req: Request, ctx: RouteContext<"/api/drafts/[draftId]">) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const d = getDraft(auth.id, (await ctx.params).draftId);
  if (!d) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  return NextResponse.json(d, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request, ctx: RouteContext<"/api/drafts/[draftId]">) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const parsed = draftBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid draft" }, { status: 400 });
  const data = JSON.stringify(parsed.data.data ?? {});
  if (data.length > MAX_DRAFT_BYTES) return NextResponse.json({ error: "Draft is too large" }, { status: 413 });
  const ok = updateDraft(auth.id, (await ctx.params).draftId, parsed.data.title.trim() || "Untitled problem", data);
  if (!ok) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/drafts/[draftId]">) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  deleteDraft(auth.id, (await ctx.params).draftId);
  return NextResponse.json({ ok: true });
}
