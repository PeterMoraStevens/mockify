import { redirect } from "next/navigation";
import { NewRoomForm } from "@/components/rooms/new-room-form";
import { MAX_OPEN_ROOMS } from "@/lib/rooms";
import { getCurrentUser } from "@/lib/server/auth";
import { openRoomCount } from "@/lib/server/rooms";
import { friendLists } from "@/lib/server/social";

export const metadata = { title: "New room · Mockify" };
export const dynamic = "force-dynamic";

/** Room options. The room itself is created only when you press Create (POST /api/rooms). */
export default async function NewRoomPage({ searchParams }: PageProps<"/room/new">) {
  const user = await getCurrentUser();
  const { mode } = await searchParams;
  const initialMode = mode === "design" ? "design" : "coding";
  if (!user) redirect(`/login?next=${encodeURIComponent(`/room/new${initialMode === "design" ? "?mode=design" : ""}`)}`);
  return (
    <NewRoomForm
      initialMode={initialMode}
      friends={friendLists(user.id).friends}
      openCount={openRoomCount(user.id)}
      maxOpen={MAX_OPEN_ROOMS}
    />
  );
}
