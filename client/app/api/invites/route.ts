import { NextResponse } from "next/server";
import { z } from "zod";
import { isRoomId } from "@/lib/room-id";
import { rateLimit, requireUser } from "@/lib/server/auth";
import { inviteToRoom, pendingInvites } from "@/lib/server/social";

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ invites: pendingInvites(auth.id) }, { headers: { "Cache-Control": "no-store" } });
}

const body = z.object({ roomId: z.string().refine(isRoomId), userId: z.uuid() });

/** Invite a friend into a room you're in. They see it on /rooms and as a toast. */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!rateLimit(`invite:${auth.id}`, 30, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many invites. Try again later." }, { status: 429 });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid invite" }, { status: 400 });

  const r = inviteToRoom(auth.id, parsed.data.roomId, parsed.data.userId);
  const errors: Partial<Record<typeof r, [string, number]>> = {
    "not-friends": ["You can only invite friends", 403],
    "room-closed": ["This room has ended", 410],
    "not-in-room": ["You're not in this room", 403],
    "already-in-room": ["They're already in this room", 409],
  };
  const err = errors[r];
  if (err) return NextResponse.json({ error: err[0] }, { status: err[1] });
  return NextResponse.json({ ok: true });
}
