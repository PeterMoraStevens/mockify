import { redirect } from "next/navigation";
import { LibraryClient } from "@/components/problems/library-client";
import { getProblem } from "@/lib/problems/store";
import { getCurrentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { listDrafts } from "@/lib/server/drafts";

export const metadata = { title: "Your problems · Mockify" };
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/problems/library");
  const owned = (
    db().prepare("SELECT slug, created_at FROM problem_owners WHERE owner_id = ? ORDER BY created_at DESC").all(user.id) as {
      slug: string;
      created_at: number;
    }[]
  ).flatMap((o) => {
    const p = getProblem(o.slug);
    return p
      ? [{ slug: p.slug, title: p.title, difficulty: p.difficulty, tags: p.tags, tests: p.examples.length + p.tests.length, createdAt: o.created_at, editable: !!p.signature }]
      : [];
  });
  return <LibraryClient problems={owned} drafts={listDrafts(user.id)} />;
}
