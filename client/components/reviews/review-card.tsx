import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { REVIEW_CRITERIA } from "@/lib/rooms";
import type { Review } from "@/lib/server/reviews";
import { cn } from "@/lib/utils";

const TONES = ["bg-main", "bg-accent-blue", "bg-accent-green"];

export function ReviewCard({
  review,
  heading,
  problemTitle,
  link = true,
}: {
  review: Review;
  heading: string;
  problemTitle?: string | null;
  link?: boolean;
}) {
  const criteria = REVIEW_CRITERIA[review.authorRole];
  return (
    <article className="rounded-base border-2 border-border bg-secondary-background p-5 shadow-shadow">
      <header className="flex flex-wrap items-center gap-2">
        <span className="font-heading">{heading}</span>
        <Badge tone={review.authorRole === "interviewer" ? "violet" : "blue"}>
          {review.authorRole === "interviewer" ? "as interviewer" : "as candidate"}
        </Badge>
        {problemTitle && <Badge tone="neutral">{problemTitle}</Badge>}
        <time className="ml-auto text-xs text-muted">
          {link ? (
            <Link href={`/interviews/${review.roomId}`} className="underline underline-offset-4">
              {new Date(review.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
            </Link>
          ) : (
            new Date(review.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })
          )}
        </time>
      </header>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {criteria.map((c, i) => (
          <div key={c.key} className="rounded-base border-2 border-border bg-background p-2">
            <div className="truncate text-[10px] font-heading uppercase tracking-wide text-muted">{c.label}</div>
            <div className="mt-1 flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={cn("h-2.5 flex-1 rounded-sm border border-border", n <= review.scores[i] ? TONES[i] : "bg-secondary-background")}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {review.notes && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{review.notes}</p>}
    </article>
  );
}
