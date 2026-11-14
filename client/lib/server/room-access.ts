import "server-only";
import { NextResponse } from "next/server";
import { isRoomId } from "@/lib/room-id";
import { getRoom, isParticipant, type RoomRow } from "./rooms";

/** The room, if it exists and this user has a seat in it; otherwise the error response. */
export function participantRoom(roomId: string, userId: string): RoomRow | NextResponse {
  if (!isRoomId(roomId)) return NextResponse.json({ error: "Bad room id" }, { status: 400 });
  const room = getRoom(roomId);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (!isParticipant(roomId, userId)) return NextResponse.json({ error: "You're not in this room" }, { status: 403 });
  return room;
}
