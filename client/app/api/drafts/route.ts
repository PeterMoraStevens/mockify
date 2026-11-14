import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { MAX_DRAFT_BYTES, MAX_DRAFTS, createDraft, draftBody, listDrafts } from "@/lib/server/drafts";

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ drafts: listDrafts(auth.id) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const parsed = draftBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid draft" }, { status: 400 });
  const data = JSON.stringify(parsed.data.data ?? {});
  if (data.length > MAX_DRAFT_BYTES) return NextResponse.json({ error: "Draft is too large" }, { status: 413 });
  const id = createDraft(auth.id, parsed.data.title.trim() || "Untitled problem", data);
  if (id === "limit") {
    return NextResponse.json({ error: `You have ${MAX_DRAFTS} drafts. Delete some first.` }, { status: 409 });
  }
  return NextResponse.json({ id });
}
