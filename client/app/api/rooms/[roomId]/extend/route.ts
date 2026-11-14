import { NextResponse } from "next/server";
import { z } from "zod";
import { ROOM_EXTEND_OPTIONS_MIN, ROOM_MAX_MS } from "@/lib/rooms";
import { requireUser } from "@/lib/server/auth";
import { participantRoom } from "@/lib/server/room-access";
import { extendRoom } from "@/lib/server/rooms";

const body = z.object({ minutes: z.union(ROOM_EXTEND_OPTIONS_MIN.map((m) => z.literal(m))) });

export async function POST(req: Request, ctx: RouteContext<"/api/rooms/[roomId]/extend">) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const room = participantRoom((await ctx.params).roomId, auth.id);
  if (room instanceof NextResponse) return room;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick 15 or 30 minutes" }, { status: 400 });

  const r = extendRoom(room.id, parsed.data.minutes);
  if (r === "ended") return NextResponse.json({ error: "This room has ended" }, { status: 410 });
  if (r === "max") {
    return NextResponse.json(
      { error: `Rooms can last at most ${ROOM_MAX_MS / 3_600_000} hours. Start a new room to keep going.` },
      { status: 409 },
    );
  }
  return NextResponse.json({ expiresAt: r.expires_at, maxExpiresAt: r.created_at + ROOM_MAX_MS });
}
