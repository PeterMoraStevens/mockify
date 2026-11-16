import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { friendLists, pendingInvites } from "@/lib/server/social";

/** Everything the navbar bell shows: room invites, plus friend lists (for incoming requests and live updates). */
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(
    { invites: pendingInvites(auth.id), friends: friendLists(auth.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
