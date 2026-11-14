import { NextResponse } from "next/server";
import { ROOM_MAX_MS } from "@/lib/rooms";
import { requireUser } from "@/lib/server/auth";
import { participantRoom } from "@/lib/server/room-access";
import { isOpen } from "@/lib/server/rooms";

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
