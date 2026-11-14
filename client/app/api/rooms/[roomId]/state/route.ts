import { NextResponse } from "next/server";
import { rateLimit, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { participantRoom } from "@/lib/server/room-access";
import { MAX_YDOC_BYTES, isOpen, saveRoomDoc } from "@/lib/server/rooms";

/**
 * The saved copy of the room's shared doc, so a rejoin (new browser, cleared
 * storage, both people gone for a while) picks up where it left off, plus
 * this person's own notes.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[roomId]/state">) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const room = participantRoom((await ctx.params).roomId, auth.id);
  if (room instanceof NextResponse) return room;
  const notes = db()
    .prepare("SELECT content, shared FROM room_notes WHERE room_id = ? AND user_id = ?")
    .get(room.id, auth.id) as { content: string; shared: number } | undefined;
  return NextResponse.json(
    {
      ydoc: room.ydoc ? Buffer.from(room.ydoc).toString("base64") : null,
      notes: notes?.content ?? "",
      shareNotes: !!notes?.shared,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Body: { ydoc: base64 Yjs update }. Merged into the saved doc. */
export async function PUT(req: Request, ctx: RouteContext<"/api/rooms/[roomId]/state">) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const room = participantRoom((await ctx.params).roomId, auth.id);
  if (room instanceof NextResponse) return room;
  // A final save right after the room ends is fine; long after isn't.
  if (!isOpen(room, Date.now() - 2 * 60_000)) return NextResponse.json({ error: "Room has ended" }, { status: 410 });
  if (!rateLimit(`state:${auth.id}`, 20, 60_000)) return NextResponse.json({ error: "Slow down" }, { status: 429 });

  const body = (await req.json().catch(() => null)) as { ydoc?: unknown } | null;
  if (typeof body?.ydoc !== "string" || body.ydoc.length > (MAX_YDOC_BYTES * 4) / 3 + 4) {
    return NextResponse.json({ error: "Bad or oversized doc" }, { status: 400 });
  }
  const result = saveRoomDoc(room.id, new Uint8Array(Buffer.from(body.ydoc, "base64")));
  if (result === "too-large") return NextResponse.json({ error: "The session is too large to save" }, { status: 413 });
  if (result === "bad") return NextResponse.json({ error: "Couldn't read that doc" }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// navigator.sendBeacon (used for the last save when the tab closes) can only POST.
export { PUT as POST };
