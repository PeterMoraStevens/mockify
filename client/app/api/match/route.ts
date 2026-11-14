import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { createRoom } from "@/lib/server/rooms";

/**
 * "Available now" matchmaking. In-memory, which is fine for one homelab
 * process: a restart just empties the queue. Clients poll GET every ~2s;
 * anyone who stops polling for 15s drops out.
 */

type Waiting = { userId: string; name: string; since: number; lastSeen: number };
type Match = { roomId: string; partnerName: string; at: number };
type State = { queue: Waiting[]; matches: Map<string, Match> };

const g = globalThis as unknown as { __mockifyMatch?: State };
const state: State = (g.__mockifyMatch ??= { queue: [], matches: new Map() });

const STALE_MS = 15_000;
const MATCH_TTL_MS = 2 * 60_000;

function prune() {
  const now = Date.now();
  state.queue = state.queue.filter((w) => now - w.lastSeen < STALE_MS);
  for (const [k, m] of state.matches) if (now - m.at > MATCH_TTL_MS) state.matches.delete(k);
}

function snapshot(userId: string) {
  prune();
  const match = state.matches.get(userId);
  if (match) return { status: "matched" as const, ...match };
  const me = state.queue.find((w) => w.userId === userId);
  const others = state.queue.filter((w) => w.userId !== userId).length;
  if (me) {
    me.lastSeen = Date.now();
    return { status: "waiting" as const, since: me.since, others };
  }
  return { status: "idle" as const, others };
}

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(snapshot(auth.id));
}

function leave(userId: string) {
  state.queue = state.queue.filter((w) => w.userId !== userId);
  state.matches.delete(userId);
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  // navigator.sendBeacon can only POST, so leaving on tab close comes through here.
  if (new URL(req.url).searchParams.get("leave") === "1") {
    leave(auth.id);
    return NextResponse.json({ status: "idle" });
  }
  prune();

  // Already matched or waiting: idempotent.
  state.matches.delete(auth.id);
  if (state.queue.some((w) => w.userId === auth.id)) return NextResponse.json(snapshot(auth.id));

  const partner = state.queue.find((w) => w.userId !== auth.id);
  if (partner) {
    state.queue = state.queue.filter((w) => w !== partner);
    // Both seats are reserved, so nobody else can wander in with the link.
    const roomId = createRoom(partner.userId, { members: [partner.userId, auth.id], skipLimit: true }) as string;
    const at = Date.now();
    state.matches.set(partner.userId, { roomId, partnerName: auth.displayName, at });
    state.matches.set(auth.id, { roomId, partnerName: partner.name, at });
    return NextResponse.json(snapshot(auth.id));
  }

  const now = Date.now();
  state.queue.push({ userId: auth.id, name: auth.displayName, since: now, lastSeen: now });
  return NextResponse.json(snapshot(auth.id));
}

export async function DELETE() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  leave(auth.id);
  return NextResponse.json({ status: "idle" });
}
