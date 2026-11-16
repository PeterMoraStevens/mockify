import { ArrowUpRight } from "lucide-react";
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
  const date = new Date(review.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" });
  const body = (
    <>
      <header className="flex flex-wrap items-center gap-2">
        <span className="font-heading">{heading}</span>
        <Badge tone={review.authorRole === "interviewer" ? "violet" : "blue"}>
          {review.authorRole === "interviewer" ? "as interviewer" : "as candidate"}
        </Badge>
        {problemTitle && <Badge tone="neutral">{problemTitle}</Badge>}
        <time className="ml-auto text-xs text-muted">{date}</time>
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
      {review.notes && <p className={cn("mt-4 whitespace-pre-wrap text-sm leading-relaxed", link && "line-clamp-3")}>{review.notes}</p>}
      {link && (
        <div className="mt-3 flex items-center gap-1 text-xs font-heading text-muted transition-colors group-hover:text-foreground">
          Open the interview: code, whiteboard and full feedback <ArrowUpRight className="size-3.5" />
        </div>
      )}
    </>
  );
  const box = "block rounded-base border-2 border-border bg-secondary-background p-5 shadow-shadow";
  if (!link) return <article className={box}>{body}</article>;
  return (
    <Link
      href={`/interviews/${review.roomId}`}
      className={cn(
        box,
        "group transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2",
      )}
    >
      {body}
    </Link>
  );
}
