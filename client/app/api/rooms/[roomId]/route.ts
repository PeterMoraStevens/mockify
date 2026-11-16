import { NextResponse } from "next/server";
import { ROOM_MAX_MS } from "@/lib/rooms";
import { requireUser } from "@/lib/server/auth";
import { participantRoom } from "@/lib/server/room-access";
import { endRoom, getRoom, isOpen, isParticipant } from "@/lib/server/rooms";
import { isRoomId } from "@/lib/room-id";

/** Deadline and status, polled by the room so an extension shows up on both sides. */
export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[roomId]">) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const room = participantRoom((await ctx.params).roomId, auth.id);
  if (room instanceof NextResponse) return room;
  return NextResponse.json(
    {
      expiresAt: room.expires_at,
      maxExpiresAt: room.created_at + ROOM_MAX_MS,
      endedAt: room.ended_at,
      open: isOpen(room),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Close a room from the Rooms page. Whoever created it, or anyone seated in
 * it, can close it. Same effect as ending the interview: the room shuts for
 * both people and the summary stays.
 */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/rooms/[roomId]">) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const roomId = (await ctx.params).roomId;
  if (!isRoomId(roomId)) return NextResponse.json({ error: "Bad room id" }, { status: 400 });
  const room = getRoom(roomId);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.created_by !== auth.id && !isParticipant(roomId, auth.id)) {
    return NextResponse.json({ error: "You're not in this room" }, { status: 403 });
  }
  endRoom(roomId);
  return NextResponse.json({ ok: true });
}
