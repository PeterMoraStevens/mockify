import { redirect } from "next/navigation";
import { RoomsClient } from "@/components/rooms/rooms-client";
import { getProblem } from "@/lib/problems/store";
import { MAX_OPEN_ROOMS } from "@/lib/rooms";
import { getCurrentUser } from "@/lib/server/auth";
import { roomsForUser } from "@/lib/server/rooms";
import { pendingInvites } from "@/lib/server/social";

export const metadata = { title: "Your rooms · Mockify" };
export const dynamic = "force-dynamic";

export default async function RoomsPage({ searchParams }: PageProps<"/rooms">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/rooms");
  const { limit } = await searchParams;
  const rooms = roomsForUser(user.id, (slug) => getProblem(slug)?.title ?? null, 100);
  return (
    <RoomsClient
      me={user.id}
      rooms={rooms}
      invites={pendingInvites(user.id)}
      limitHit={limit === "1"}
      maxOpen={MAX_OPEN_ROOMS}
    />
  );
}
