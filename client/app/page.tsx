import { ArrowRight, BookOpenCheck, Code2, MessageSquareText, Play, RotateCcw, Users } from "lucide-react";
import Link from "next/link";
import { NewRoomLink } from "@/components/new-room-link";
import { Button } from "@/components/ui/button";
import { Highlighter } from "@/components/ui/highlighter";

const FEATURES = [
  { icon: Users, title: "Practice together", body: "Send a link, or get paired with whoever's free. Swap roles whenever you like.", tone: "bg-accent-blue" },
  { icon: Code2, title: "Real problems", body: "Run code and check it against hidden tests, in the language you're interviewing in.", tone: "bg-main" },
  { icon: MessageSquareText, title: "Honest feedback", body: "Wrap up by rating each other, and track how you improve over time.", tone: "bg-accent-green" },
  { icon: RotateCcw, title: "Pick up where you left off", body: "Rejoin a room anytime it's open, and look back at past code, notes and whiteboards.", tone: "bg-accent-yellow" },
];

const STEPS = [
  { title: "Open a room", body: "Pick coding or system design. You get a link that's good for an hour.", tone: "bg-main" },
  { title: "Bring a partner", body: "Invite a friend, send the link, or get matched with someone free.", tone: "bg-accent-blue" },
  { title: "Interview, then review", body: "Solve it together, then rate each other and keep the notes.", tone: "bg-accent-green" },
];

export default function Home() {
  return (
    <main>
      {/* ----------------------------------------------------------- hero */}
      <section className="relative overflow-hidden border-b-4 border-border bg-grid">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <h1 className="text-5xl leading-[1.02] sm:text-6xl lg:text-7xl">
              Practice interviews,{" "}
              <span className="relative inline-block">
                <span className="relative z-10">together.</span>
                <span className="absolute inset-x-0 bottom-1 -z-0 h-4 -rotate-1 bg-main sm:h-5" aria-hidden />
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg sm:text-xl">
              Video, a shared editor, a whiteboard and{" "}
              <Highlighter action="underline" color="#FF9800">
                real test cases
              </Highlighter>
              , all in one link. Take turns as interviewer and candidate, then give each other feedback.
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
          </div>
          <ol className="grid gap-4">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex items-start gap-4 rounded-base border-2 border-border bg-secondary-background p-5 shadow-shadow"
                style={{ marginLeft: `${i * 1.5}rem` }}
              >
                <span className={`grid size-10 shrink-0 place-items-center rounded-base border-2 border-border font-heading text-lg text-black ${step.tone}`}>
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg">{step.title}</h3>
                  <p className="mt-0.5 text-sm text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ----------------------------------------------------- features */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <SectionTitle kicker="What you get" title="Everything a practice interview needs." />
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
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
            <p className="mt-4 text-lg">Open a room and send the link, or join the queue to meet someone new.</p>
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
          <span className="font-heading">Mockify</span>
          <span className="text-muted">Open source &middot; MIT licensed &middot; built for practicing together</span>
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
