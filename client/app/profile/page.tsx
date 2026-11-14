import { CalendarDays, MessageSquareQuote, Send } from "lucide-react";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { ReviewCard } from "@/components/reviews/review-card";
import { getProblem } from "@/lib/problems/store";
import { REVIEW_CRITERIA, type ReviewRole } from "@/lib/rooms";
import { getCurrentUser } from "@/lib/server/auth";
import { reviewsAbout, reviewsBy, type Review } from "@/lib/server/reviews";
import { cn } from "@/lib/utils";

const TONES = ["bg-main", "bg-accent-blue", "bg-accent-green"];

function averages(reviews: Review[]): (number | null)[] {
  return [0, 1, 2].map((i) => (reviews.length ? reviews.reduce((s, r) => s + r.scores[i], 0) / reviews.length : null));
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");

  const received = reviewsAbout(user.id);
  const given = reviewsBy(user.id);
  // Reviews written by your interviewers rate you as a candidate, and vice versa.
  const asCandidate = received.filter((r) => r.authorRole === "interviewer");
  const asInterviewer = received.filter((r) => r.authorRole === "candidate");
  const title = (slug: string | null) => (slug ? (getProblem(slug)?.title ?? slug) : null);

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
          <Stat label="Reviews received" value={received.length} />
          <Stat label="Reviews given" value={given.length} />
        </div>
      </section>

      <ScoreRow title="You as a candidate" role="interviewer" avg={averages(asCandidate)} count={asCandidate.length} />
      <ScoreRow title="You as an interviewer" role="candidate" avg={averages(asInterviewer)} count={asInterviewer.length} />

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <ReviewList
          title="Feedback you received"
          icon={<MessageSquareQuote />}
          empty="No feedback yet. When an interview ends, the other person can rate how it went."
        >
          {received.map((r) => (
            <ReviewCard key={r.id} review={r} heading={`from ${r.authorName}`} problemTitle={title(r.problemSlug)} />
          ))}
        </ReviewList>
        <ReviewList
          title="Feedback you gave"
          icon={<Send />}
          empty="Use End interview in a room to wrap up and rate each other."
        >
          {given.map((r) => (
            <ReviewCard key={r.id} review={r} heading={`for ${r.subjectName}`} problemTitle={title(r.problemSlug)} />
          ))}
        </ReviewList>
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

function ScoreRow({
  title,
  role,
  avg,
  count,
}: {
  title: string;
  role: ReviewRole;
  avg: (number | null)[];
  count: number;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-heading uppercase tracking-widest text-muted">
        {title} &middot; {count} review{count === 1 ? "" : "s"}
      </h2>
      <div className="mt-3 grid gap-5 sm:grid-cols-3">
        {REVIEW_CRITERIA[role].map((c, i) => (
          <div key={c.key} className="rounded-base border-2 border-border bg-secondary-background p-5 shadow-lg">
            <div className="text-xs font-heading uppercase tracking-widest text-muted">{c.label}</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-5xl font-heading">{avg[i] === null ? "–" : avg[i]!.toFixed(1)}</span>
              <span className="font-heading text-muted">/ 5</span>
            </div>
            <div className="mt-4 h-4 overflow-hidden rounded-base border-2 border-border bg-background">
              <div className={cn("h-full border-r-2 border-border", TONES[i])} style={{ width: `${((avg[i] ?? 0) / 5) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReviewList({
  title,
  icon,
  empty,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-2xl [&_svg]:size-6">
        {icon} {title}
      </h2>
      <div className="mt-5 space-y-4">
        {children.length === 0 ? (
          <div className="rounded-base border-2 border-dashed border-border p-8 text-center text-sm text-muted">{empty}</div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
