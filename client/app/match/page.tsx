import { redirect } from "next/navigation";
import { MatchQueue } from "@/components/match-queue";
import { getCurrentUser } from "@/lib/server/auth";

export default async function MatchPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/match");
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-grid px-4 py-16">
      <MatchQueue name={user.displayName} />
    </main>
  );
}
