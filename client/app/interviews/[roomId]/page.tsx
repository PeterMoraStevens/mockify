import { CalendarDays, Clock, Code2, MessageSquareQuote, NotebookPen, PenTool, RotateCcw, Users } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CodeView } from "@/components/interviews/code-view";
import { BoardView, LateReview, MyNotes } from "@/components/interviews/summary-client";
import { ReviewCard } from "@/components/reviews/review-card";
import { Badge, DifficultyBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LANGUAGES, isLanguageId } from "@/lib/languages";
import { getProblem } from "@/lib/problems/store";
import { isRoomId } from "@/lib/room-id";
import { REVIEW_WINDOW_MS, type ReviewRole } from "@/lib/rooms";
import { getCurrentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { reviewsForRoom } from "@/lib/server/reviews";
import { getRoom, isOpen, isParticipant, participantIds } from "@/lib/server/rooms";

export const metadata = { title: "Interview summary · Mockify" };
export const dynamic = "force-dynamic";

/** Request time. (A plain function so the render itself stays pure.) */
const serverNow = () => Date.now();

export default async function InterviewPage({ params }: PageProps<"/interviews/[roomId]">) {
  const { roomId } = await params;
  if (!isRoomId(roomId)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/interviews/${roomId}`);
  const room = getRoom(roomId);
  if (!room || !isParticipant(roomId, user.id)) notFound();

  const open = isOpen(room);
  const now = serverNow();
  const endedAt = room.ended_at ?? Math.min(room.expires_at, now);
  const partnerId = participantIds(roomId).find((id) => id !== user.id) ?? null;
  const partner = partnerId
    ? (db().prepare("SELECT display_name, username FROM users WHERE id = ?").get(partnerId) as { display_name: string; username: string })
    : null;
  const notes = db().prepare("SELECT user_id, content, shared FROM room_notes WHERE room_id = ?").all(roomId) as {
    user_id: string;
    content: string;
    shared: number;
  }[];
  const mine = notes.find((n) => n.user_id === user.id);
  const theirs = notes.find((n) => n.user_id === partnerId && n.shared && n.content.trim());
  const reviews = reviewsForRoom(roomId);
  const mineReview = reviews.find((r) => r.authorId === user.id);
  const theirReview = reviews.find((r) => r.authorId === partnerId);
  const problem = room.problem_slug ? getProblem(room.problem_slug) : null;
  const canReview = !!partner && !mineReview && now < endedAt + REVIEW_WINDOW_MS;
  // Without a stored role, guess from their review (if they wrote one); default to interviewer.
  const myRole: ReviewRole = theirReview ? (theirReview.authorRole === "interviewer" ? "candidate" : "interviewer") : "interviewer";
  const elements = room.whiteboard ? JSON.parse(room.whiteboard) : [];
  const lang = room.language && isLanguageId(room.language) ? LANGUAGES[room.language].label : null;
  const minutes = Math.max(1, Math.round((endedAt - room.created_at) / 60_000));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="rounded-base border-4 border-border bg-secondary-background p-6 shadow-xl">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-heading uppercase tracking-widest text-muted">Interview summary</p>
            <h1 className="mt-1 text-3xl sm:text-4xl">{problem?.title ?? (room.problem_slug ? room.problem_slug : "Free-form session")}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-4" />
                {new Date(room.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-4" /> {open ? "in progress" : `${minutes} min`}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="size-4" /> {user.displayName}
                {partner ? ` & ${partner.display_name}` : " (nobody else joined)"}
              </span>
              {problem && <DifficultyBadge difficulty={problem.difficulty} />}
            </div>
          </div>
          {open && (
            <Button asChild>
              <Link href={`/room/${roomId}`}>
                <RotateCcw /> Rejoin room
              </Link>
            </Button>
          )}
        </div>
      </section>

      {canReview && (
        <Section icon={<MessageSquareQuote />} title={`Rate ${partner!.display_name}`}>
          <div className="rounded-base border-2 border-border bg-secondary-background p-5 shadow-lg">
            <LateReview roomId={roomId} role={myRole} subjectName={partner!.display_name} problemSlug={room.problem_slug} />
          </div>
        </Section>
      )}

      {(theirReview || mineReview) && (
        <Section icon={<MessageSquareQuote />} title="Feedback">
          <div className="grid gap-4 lg:grid-cols-2">
            {theirReview && <ReviewCard review={theirReview} heading={`From ${theirReview.authorName}`} link={false} />}
            {mineReview && <ReviewCard review={mineReview} heading={`You, for ${mineReview.subjectName}`} link={false} />}
          </div>
        </Section>
      )}

      <Section icon={<Code2 />} title="Code" right={lang && <Badge tone="neutral">{lang}</Badge>}>
        <div className="overflow-hidden rounded-base border-2 border-border bg-secondary-background shadow-lg">
          {room.code?.trim() ? (
            <CodeView code={room.code} language={room.language} />
          ) : (
            <p className="p-6 text-center text-sm text-muted">No code was saved for this interview.</p>
          )}
        </div>
      </Section>

      {elements.length > 0 && (
        <Section icon={<PenTool />} title="Whiteboard">
          <div className="overflow-hidden rounded-base border-2 border-border shadow-lg">
            <BoardView elements={elements} />
          </div>
        </Section>
      )}

      <Section icon={<NotebookPen />} title="Notes">
        <div className={theirs ? "grid gap-4 lg:grid-cols-2" : ""}>
          <div className="rounded-base border-2 border-border bg-secondary-background p-4 shadow-lg">
            <h3 className="mb-3 text-sm font-heading">Your notes</h3>
            <MyNotes roomId={roomId} initial={mine?.content ?? ""} initialShared={!!mine?.shared} partnerName={partner?.display_name ?? null} />
          </div>
          {theirs && (
            <div className="rounded-base border-2 border-border bg-accent-blue/20 p-4 shadow-lg">
              <h3 className="mb-3 text-sm font-heading">{partner!.display_name}&apos;s shared notes</h3>
              <pre className="font-mono text-xs leading-5 whitespace-pre-wrap">{theirs.content}</pre>
            </div>
          )}
        </div>
      </Section>
    </main>
  );
}

function Section({ icon, title, right, children }: { icon: React.ReactNode; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 flex items-center gap-2 text-2xl [&_svg]:size-6">
        {icon} {title} <span className="ml-auto">{right}</span>
      </h2>
      {children}
    </section>
  );
}
