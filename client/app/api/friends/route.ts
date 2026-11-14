import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, requireUser } from "@/lib/server/auth";
import { acceptFriend, friendLists, removeFriend, requestFriend } from "@/lib/server/social";

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(friendLists(auth.id), { headers: { "Cache-Control": "no-store" } });
}

const add = z.object({ username: z.string().trim().min(1).max(32) });

/** Send a friend request by username (accepts theirs if they already asked). */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!rateLimit(`friend:${auth.id}`, 30, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }
  const parsed = add.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a username" }, { status: 400 });

  const r = requestFriend(auth.id, parsed.data.username);
  const errors: Partial<Record<typeof r, [string, number]>> = {
    "not-found": ["No one has that username", 404],
    self: ["That's you", 400],
    already: ["Already friends or already requested", 409],
    limit: ["Friend list is full", 409],
  };
  const err = errors[r];
  if (err) return NextResponse.json({ error: err[0] }, { status: err[1] });
  return NextResponse.json({ status: r, ...friendLists(auth.id) });
}

const patch = z.object({ userId: z.uuid(), action: z.enum(["accept", "remove"]) });

/** Accept a request, or remove (decline / cancel / unfriend). */
export async function PATCH(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (parsed.data.action === "accept") {
    if (!acceptFriend(auth.id, parsed.data.userId)) {
      return NextResponse.json({ error: "No pending request from them" }, { status: 404 });
    }
  } else {
    removeFriend(auth.id, parsed.data.userId);
  }
  return NextResponse.json(friendLists(auth.id));
}
