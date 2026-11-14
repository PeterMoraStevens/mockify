import { redirect } from "next/navigation";
import { FriendsClient } from "@/components/rooms/friends-client";
import { getCurrentUser } from "@/lib/server/auth";
import { friendLists } from "@/lib/server/social";

export const metadata = { title: "Friends · Mockify" };
export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/friends");
  return <FriendsClient username={user.username} initial={friendLists(user.id)} />;
}
