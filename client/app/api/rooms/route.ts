import { NextResponse } from "next/server";
import { getProblem } from "@/lib/problems/store";
import { requireUser } from "@/lib/server/auth";
import { pendingInvites } from "@/lib/server/social";
import { roomsForUser } from "@/lib/server/rooms";

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
