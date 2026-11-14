import { CalendarDays, MessageSquareQuote, Send } from "lucide-react";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { getProblem } from "@/lib/problems/store";
import { getCurrentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  room_id: string;
  problem_slug: string | null;
  problem_solving: number;
  communication: number;
  code_quality: number;
  notes: string;
  created_at: number;
  other_name: string;
};

const CATEGORIES = [
  ["problem_solving", "Problem solving", "bg-main"],
  ["communication", "Communication", "bg-accent-blue"],
  ["code_quality", "Code quality", "bg-accent-green"],
] as const;

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");

  const received = db()
    .prepare(
      `SELECT f.*, u.display_name AS other_name FROM feedback f
       JOIN users u ON u.id = f.interviewer_id
       WHERE f.candidate_id = ? ORDER BY f.created_at DESC LIMIT 100`,
    )
    .all(user.id) as Row[];
  const given = db()
    .prepare(
      `SELECT f.*, u.display_name AS other_name FROM feedback f
       JOIN users u ON u.id = f.candidate_id
       WHERE f.interviewer_id = ? ORDER BY f.created_at DESC LIMIT 100`,
    )
    .all(user.id) as Row[];

  const avg = (k: (typeof CATEGORIES)[number][0]) =>
    received.length ? received.reduce((s, r) => s + r[k], 0) / received.length : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <section className="flex flex-wrap items-center gap-6 rounded-base border-4 border-border bg-secondary-background p-6 shadow-xl">
        <Avatar name={user.displayName} className="size-20 text-2xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-4xl">{user.displayName}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            @{user.username} <span>&middot;</span> <CalendarDays className="size-4" /> joined{" "}
            {new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-3">
          <Stat label="Interviews received" value={received.length} />
          <Stat label="Interviews given" value={given.length} />
        </div>
      </section>

      <section className="mt-8 grid gap-5 sm:grid-cols-3">
        {CATEGORIES.map(([k, label, color]) => {
          const a = avg(k);
          return (
            <div key={k} className="rounded-base border-2 border-border bg-secondary-background p-5 shadow-lg">
              <div className="text-xs font-heading uppercase tracking-widest text-muted">{label}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-5xl font-heading">{a === null ? "–" : a.toFixed(1)}</span>
                <span className="font-heading text-muted">/ 5</span>
              </div>
              <div className="mt-4 h-4 overflow-hidden rounded-base border-2 border-border bg-background">
                <div className={cn("h-full border-r-2 border-border", color)} style={{ width: `${((a ?? 0) / 5) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </section>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <FeedbackList
          title="Feedback you received"
          icon={<MessageSquareQuote />}
          rows={received}
          otherLabel="from"
          empty="No feedback yet. After a mock interview, your interviewer can leave scores and notes here."
        />
        <FeedbackList
          title="Feedback you gave"
          icon={<Send />}
          rows={given}
          otherLabel="for"
          empty="When you interview someone, use the Feedback button in the room to leave them scores and notes."
        />
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-28 rounded-base border-2 border-border bg-background px-4 py-2 text-center shadow-shadow">
      <div className="text-3xl font-heading">{value}</div>
      <div className="text-[10px] font-heading uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

function FeedbackList({
  title,
  icon,
  rows,
  otherLabel,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  rows: Row[];
  otherLabel: string;
  empty: string;
}) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-2xl [&_svg]:size-6">
        {icon} {title}
      </h2>
      <div className="mt-5 space-y-4">
        {rows.length === 0 && (
          <div className="rounded-base border-2 border-dashed border-border p-8 text-center text-sm text-muted">{empty}</div>
        )}
        {rows.map((r) => (
          <article key={r.id} className="rounded-base border-2 border-border bg-secondary-background p-5 shadow-shadow">
            <header className="flex flex-wrap items-center gap-2">
              <span className="font-heading">
                {otherLabel} {r.other_name}
              </span>
              {r.problem_slug && <Badge tone="neutral">{getProblem(r.problem_slug)?.title ?? r.problem_slug}</Badge>}
              <time className="ml-auto text-xs text-muted">
                {new Date(r.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
              </time>
            </header>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {CATEGORIES.map(([k, label, color]) => (
                <div key={k} className="rounded-base border-2 border-border bg-background p-2">
                  <div className="truncate text-[10px] font-heading uppercase tracking-wide text-muted">{label}</div>
                  <div className="mt-1 flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={cn("h-2.5 flex-1 rounded-sm border border-border", n <= r[k] ? color : "bg-secondary-background")} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {r.notes && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{r.notes}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
