import { NextResponse } from "next/server";
import { newRoomId } from "@/lib/room-id";

// No rooms table: a room is just an unguessable ID. Whoever opens it first takes slot "a".
export async function GET(req: Request) {
  return NextResponse.redirect(new URL(`/room/${newRoomId()}`, req.url), { status: 303 });
}

export const dynamic = "force-dynamic";
