import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_OPEN_ROOMS, ROOM_LENGTH_OPTIONS_MIN, ROOM_MODES } from "@/lib/rooms";
import { getProblem } from "@/lib/problems/store";
import { rateLimit, requireUser } from "@/lib/server/auth";
import { inviteToRoom, pendingInvites } from "@/lib/server/social";
import { createRoom, roomsForUser } from "@/lib/server/rooms";

/** Your rooms (open ones first) and pending invites. */
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const rooms = roomsForUser(auth.id, (slug) => getProblem(slug)?.title ?? null);
  return NextResponse.json(
    { rooms, invites: pendingInvites(auth.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const createBody = z.object({
  mode: z.enum(ROOM_MODES).default("coding"),
  minutes: z
    .number()
    .int()
    .refine((m) => (ROOM_LENGTH_OPTIONS_MIN as readonly number[]).includes(m), "Pick one of the offered lengths")
    .default(60),
  invite: z.array(z.uuid()).max(10).default([]),
});

/** Creates a room with the chosen options, and invites any friends picked. Rooms are only made here, on confirm. */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!rateLimit(`room-create:${auth.id}`, 20, 60 * 60_000)) {
    return NextResponse.json({ error: "Too many rooms created. Try again later." }, { status: 429 });
  }
  const parsed = createBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid options" }, { status: 400 });
  const { mode, minutes, invite } = parsed.data;
  const id = createRoom(auth.id, { mode, lengthMs: minutes * 60_000 });
  if (id === "limit") {
    return NextResponse.json({ error: `You already have ${MAX_OPEN_ROOMS} open rooms. Close one first.` }, { status: 409 });
  }
  const notInvited = invite.filter((uid) => inviteToRoom(auth.id, id, uid) !== "ok");
  return NextResponse.json({ id, notInvited });
}
