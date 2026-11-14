import {
  ArrowRight,
  BookOpenCheck,
  Camera,
  Clock,
  Code2,
  Lightbulb,
  Lock,
  MessageSquareText,
  NotebookPen,
  PenTool,
  Play,
  Repeat2,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { NewRoomLink } from "@/components/new-room-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Highlighter } from "@/components/ui/highlighter";
import Marquee from "@/components/ui/marquee";
import { ArchitectureDiagram } from "@/components/landing/architecture";
import { RoomPreview } from "@/components/landing/room-preview";
import { LANGUAGE_IDS } from "@/lib/languages";

const STEPS = [
  {
    n: "01",
    title: "Open a link",
    body: "Hit New interview and send the link. The first person takes slot A, the second takes B and calls A. No rooms database.",
  },
  {
    n: "02",
    title: "Connect directly",
    body: "Your server hands out 4-hour TURN credentials. WebRTC tries a direct path first and only relays through Cloudflare if it has to.",
  },
  {
    n: "03",
    title: "Share everything",
    body: "Editor, problem, language, roles, timer, whiteboard and results sync browser to browser. The server never sees the session.",
  },
  {
    n: "04",
    title: "Run for real",
    body: "Run and Submit go to your own Piston instance over the LAN. Hidden tests are graded on the server and never reach the browser.",
  },
];

const FEATURES = [
  { icon: Code2, title: "Shared editor", body: `CodeMirror 6 with live cursors for both people, in ${LANGUAGE_IDS.length} languages.`, tone: "bg-main" },
  { icon: Camera, title: "Video & screen share", body: "Mute, camera and screen share, plus a device check before you join.", tone: "bg-accent-blue" },
  { icon: Repeat2, title: "Roles you can swap", body: "Interviewer and candidate, switched with one click when it's your turn.", tone: "bg-accent-yellow" },
  { icon: Clock, title: "Shared timer", body: "One countdown both people see, corrected for clock drift between machines.", tone: "bg-accent-green" },
  { icon: Lightbulb, title: "Interviewer-only hints", body: "Hints, follow-ups and expected complexity, shown only to the interviewer.", tone: "bg-accent-violet" },
  { icon: NotebookPen, title: "Private notes", body: "Notes that stay in the interviewer's own browser.", tone: "bg-accent-red" },
  { icon: PenTool, title: "Whiteboard", body: "Excalidraw built in and synced live, for system design rounds.", tone: "bg-accent-blue" },
  { icon: MessageSquareText, title: "Written feedback", body: "Scores and notes saved to the candidate's profile to look back on.", tone: "bg-main" },
];

export default function Home() {
  return (
    <main>
      {/* ----------------------------------------------------------- hero */}
      <section className="relative overflow-hidden border-b-4 border-border bg-grid">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <Badge tone="neutral" shadow className="mb-6">
              <ShieldCheck /> Self-hosted &middot; peer-to-peer &middot; open source
            </Badge>
            <h1 className="text-5xl leading-[1.02] sm:text-6xl lg:text-7xl">
              Mock interviews on <span className="whitespace-nowrap">your own</span>{" "}
              <span className="relative inline-block">
                <span className="relative z-10">hardware.</span>
                <span className="absolute inset-x-0 bottom-1 -z-0 h-4 -rotate-1 bg-main sm:h-5" aria-hidden />
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg sm:text-xl">
              Send a link and you&apos;re both in: video, a shared editor, a whiteboard and a{" "}
              <Highlighter action="underline" color="#FF9800">
                real code judge
              </Highlighter>
              . Calls run directly between browsers. The only thing your server does is pass along connection details.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="h-14 px-7 text-base font-heading">
                <NewRoomLink>
                  Start an interview <ArrowRight className="size-5!" />
                </NewRoomLink>
              </Button>
              <Button asChild size="lg" variant="neutral" className="h-14 px-7 text-base font-heading">
                <Link href="/match">
                  Find a partner <Users className="size-5!" />
                </Link>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-3">
              {[
                ["0", "rooms in a DB"],
                ["2", "browsers, 1 link"],
                [String(LANGUAGE_IDS.length), "languages judged"],
              ].map(([k, v]) => (
                <div key={v} className="rounded-base border-2 border-border bg-secondary-background p-3 shadow-shadow">
                  <dt className="text-3xl font-heading">{k}</dt>
                  <dd className="text-xs font-heading uppercase tracking-wide text-muted">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <RoomPreview />
        </div>
      </section>

      <Marquee
        items={[
          "Direct WebRTC",
          "Cloudflare TURN fallback",
          "Piston on your LAN",
          "Hidden tests stay hidden",
          "Excalidraw whiteboard",
          "Interviewer hints",
          "No recordings",
        ]}
      />

      {/* -------------------------------------------------- how it works */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <SectionTitle kicker="How a session works" title="Four steps, no middleman." />
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="group relative rounded-base border-2 border-border bg-secondary-background p-6 shadow-lg transition-transform hover:-translate-y-1"
            >
              <span className="absolute -top-4 left-5 rounded-base border-2 border-border bg-main px-2 py-0.5 font-mono text-sm font-bold text-main-foreground">
                {s.n}
              </span>
              <h3 className="mt-2 text-xl">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------- architecture */}
      <section className="border-y-4 border-border bg-secondary-background bg-dots">
        <div className="mx-auto max-w-7xl px-4 py-20">
          <SectionTitle
            kicker="Architecture"
            title="Everything heavy runs in your homelab."
            body="Your browsers talk to each other directly. The tunnel only carries the app and signaling, and Piston is never exposed at all."
          />
          <ArchitectureDiagram />
        </div>
      </section>

      {/* ----------------------------------------------------- features */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <SectionTitle kicker="In the room" title="Everything you need for an interview." />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body, tone }) => (
            <div key={title} className="rounded-base border-2 border-border bg-secondary-background p-5 shadow-shadow">
              <span className={`grid size-11 place-items-center rounded-base border-2 border-border text-black ${tone}`}>
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 text-lg">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- cta */}
      <section className="mx-auto max-w-7xl px-4 pb-24">
        <div className="relative overflow-hidden rounded-base border-4 border-border bg-main p-8 text-main-foreground shadow-xl sm:p-12">
          <div className="absolute -right-10 -top-10 size-48 rotate-12 rounded-base border-4 border-border bg-accent-yellow" aria-hidden />
          <div className="absolute -bottom-12 right-32 size-28 -rotate-6 rounded-full border-4 border-border bg-accent-blue" aria-hidden />
          <div className="relative max-w-2xl">
            <h2 className="text-4xl sm:text-5xl">Your next interview is one link away.</h2>
            <p className="mt-4 text-lg">
              Open a room, send the link, and start talking. Want practice with someone new? Join the queue and we&apos;ll pair you with whoever&apos;s free.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild size="lg" variant="neutral" className="h-13 px-6 font-heading">
                <NewRoomLink>
                  <Play /> New interview
                </NewRoomLink>
              </Button>
              <Button asChild size="lg" variant="neutral" className="h-13 px-6 font-heading">
                <Link href="/problems">
                  <BookOpenCheck /> Browse problems
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t-4 border-border bg-secondary-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm">
          <span className="flex items-center gap-2 font-heading">
            <Lock className="size-4" /> No recordings. Sessions never touch the server.
          </span>
          <span className="text-muted">MIT licensed &middot; built for practicing together</span>
        </div>
      </footer>
    </main>
  );
}

function SectionTitle({ kicker, title, body }: { kicker: string; title: string; body?: string }) {
  return (
    <div className="max-w-2xl">
      <div className="mb-3 inline-block rounded-base border-2 border-border bg-accent-yellow px-2 py-0.5 text-xs font-heading uppercase tracking-widest text-black">
        {kicker}
      </div>
      <h2 className="text-4xl sm:text-5xl">{title}</h2>
      {body && <p className="mt-4 text-lg text-muted">{body}</p>}
    </div>
  );
}
