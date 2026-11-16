import { notFound, redirect } from "next/navigation";
import { RoomClosed } from "@/components/room/room-closed";
import { Room } from "@/components/room/room";
import { isRoomId } from "@/lib/room-id";
import { ROOM_MAX_MS, isRoomMode } from "@/lib/rooms";
import { getCurrentUser } from "@/lib/server/auth";
import { getRoom, isOpen, isParticipant, participantIds } from "@/lib/server/rooms";

export const metadata = { title: "Interview room · Mockify" };
export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: PageProps<"/room/[roomId]">) {
  const { roomId } = await params;
  if (!isRoomId(roomId)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/room/${roomId}`);

  const room = getRoom(roomId);
  if (!room) return <RoomClosed kind="missing" />;
  const member = isParticipant(roomId, user.id);
  if (!isOpen(room)) {
    if (member) redirect(`/interviews/${roomId}`);
    return <RoomClosed kind="ended" />;
  }
  if (!member && participantIds(roomId).length >= 2) return <RoomClosed kind="full" />;

  return (
    <Room
      roomId={roomId}
      user={{ id: user.id, displayName: user.displayName }}
      deadline={{ expiresAt: room.expires_at, maxExpiresAt: room.created_at + ROOM_MAX_MS }}
      initialMode={isRoomMode(room.mode) ? room.mode : "coding"}
    />
  );
}
