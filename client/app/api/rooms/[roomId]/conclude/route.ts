import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { participantRoom } from "@/lib/server/room-access";
import { endRoom } from "@/lib/server/rooms";

/** Ends the interview for both people. The room closes; the summary stays. */
export async function POST(_req: Request, ctx: RouteContext<"/api/rooms/[roomId]/conclude">) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const room = participantRoom((await ctx.params).roomId, auth.id);
  if (room instanceof NextResponse) return room;
  endRoom(room.id);
  return NextResponse.json({ ok: true });
}
