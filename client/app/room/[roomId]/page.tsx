import { notFound, redirect } from "next/navigation";
import { Room } from "@/components/room/room";
import { isRoomId } from "@/lib/room-id";
import { getCurrentUser } from "@/lib/server/auth";

export const metadata = { title: "Interview room · Mockify" };

export default async function RoomPage({ params }: PageProps<"/room/[roomId]">) {
  const { roomId } = await params;
  if (!isRoomId(roomId)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/room/${roomId}`);
  return <Room roomId={roomId} user={{ id: user.id, displayName: user.displayName }} />;
}
