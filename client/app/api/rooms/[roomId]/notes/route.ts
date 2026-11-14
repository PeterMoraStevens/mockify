import { NextResponse } from "next/server";
import { z } from "zod";
import { REVIEW_WINDOW_MS } from "@/lib/rooms";
import { rateLimit, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { participantRoom } from "@/lib/server/room-access";

const body = z.object({ content: z.string().max(50_000), shared: z.boolean() });

/** Your notes for this room. `shared` lets the other person read them (in the room and afterwards). */
export async function PUT(req: Request, ctx: RouteContext<"/api/rooms/[roomId]/notes">) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const room = participantRoom((await ctx.params).roomId, auth.id);
  if (room instanceof NextResponse) return room;
  const end = room.ended_at ?? room.expires_at;
  if (Date.now() > end + REVIEW_WINDOW_MS) return NextResponse.json({ error: "This interview is archived" }, { status: 410 });
  if (!rateLimit(`notes:${auth.id}`, 60, 60_000)) return NextResponse.json({ error: "Slow down" }, { status: 429 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid notes" }, { status: 400 });
  db()
    .prepare(
      `INSERT INTO room_notes (room_id, user_id, content, shared, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (room_id, user_id) DO UPDATE SET content = excluded.content, shared = excluded.shared, updated_at = excluded.updated_at`,
    )
    .run(room.id, auth.id, parsed.data.content, parsed.data.shared ? 1 : 0, Date.now());
  return NextResponse.json({ ok: true });
}
