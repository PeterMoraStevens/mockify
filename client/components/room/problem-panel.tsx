"use client";

import { BookOpen, ChevronDown, Eye, EyeOff, Gauge, Lightbulb, ListChecks, NotebookPen, Share2, Sparkles } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge, DifficultyBadge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { InterviewerProblem, ProblemSummary } from "@/lib/problems/schema";
import { formatOutput, formatValue, type Signature } from "@/lib/problems/starters";
import type { SharedNote } from "@/lib/room/session-doc";
import { cn } from "@/lib/utils";
import type { AnyProblem } from "./room-view";

type Tab = "problem" | "interviewer" | "notes";

export function ProblemPanel({
  notes,
  problem,
  problems,
  isInterviewer,
  selectedSlug,
  onPick,
  remoteName,
}: {
  notes: NotesProps;
  problem: AnyProblem | null;
  problems: ProblemSummary[];
  isInterviewer: boolean;
  selectedSlug: string | null;
  onPick: (slug: string | null) => void;
  remoteName: string | null;
}) {
  const [tab, setTab] = useState<Tab>("problem");
  const effectiveTab = !isInterviewer && tab === "interviewer" ? "problem" : tab;
  const interviewer = isInterviewer && problem && "interviewer" in problem ? (problem as InterviewerProblem).interviewer : null;

  return (
    <section className="flex h-full min-h-0 flex-col rounded-base border-2 border-border bg-secondary-background shadow-lg">
      <Tabs
        className="bg-background"
        value={effectiveTab}
        onChange={setTab}
        items={[
          { value: "problem", label: "Problem", icon: <BookOpen /> },
          { value: "interviewer", label: "Guide", icon: <Lightbulb />, hidden: !isInterviewer, dot: !!interviewer?.hints.length },
          { value: "notes", label: "Notes", icon: <NotebookPen />, dot: !!notes.partnerNote?.text.trim() },
        ]}
      />
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {effectiveTab === "problem" && (
          <ProblemTab
            problem={problem}
            problems={problems}
            isInterviewer={isInterviewer}
            selectedSlug={selectedSlug}
            onPick={onPick}
            remoteName={remoteName}
          />
        )}
        {effectiveTab === "interviewer" && <GuideTab problem={problem} guide={interviewer} />}
        {effectiveTab === "notes" && <NotesTab notes={notes} isInterviewer={isInterviewer} remoteName={remoteName} />}
      </div>
    </section>
  );
}

function ProblemPicker({
  problems,
  selectedSlug,
  onPick,
}: {
  problems: ProblemSummary[];
  selectedSlug: string | null;
  onPick: (slug: string | null) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 w-full items-center justify-between gap-2 rounded-base border-2 border-border bg-main px-3 text-sm font-heading text-main-foreground shadow-shadow transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none">
        <span className="flex items-center gap-2">
          <Sparkles className="size-4" /> {selectedSlug ? "Change problem" : "Pick a problem"}
        </span>
        <ChevronDown className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="z-100 max-h-[60vh] w-80 overflow-y-auto" align="start">
        <DropdownMenuLabel>Problem set</DropdownMenuLabel>
        {problems.map((p) => (
          <DropdownMenuItem key={p.slug} onClick={() => onPick(p.slug)} className={cn(p.slug === selectedSlug && "bg-main/30")}>
            <span className="min-w-0 flex-1 truncate">{p.title}</span>
            <DifficultyBadge difficulty={p.difficulty} />
          </DropdownMenuItem>
        ))}
        {selectedSlug && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onPick(null)}>No problem (free-form)</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProblemTab({
  problem,
  problems,
  isInterviewer,
  selectedSlug,
  onPick,
  remoteName,
}: {
  problem: AnyProblem | null;
  problems: ProblemSummary[];
  isInterviewer: boolean;
  selectedSlug: string | null;
  onPick: (slug: string | null) => void;
  remoteName: string | null;
}) {
  if (!problem) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="grid size-16 rotate-3 place-items-center rounded-base border-2 border-border bg-accent-yellow text-black shadow-lg">
          <BookOpen className="size-7" />
        </div>
        {selectedSlug ? (
          <p className="text-sm text-muted">Loading problem…</p>
        ) : isInterviewer ? (
          <>
            <div>
              <h3 className="text-xl">You&apos;re interviewing</h3>
              <p className="mt-1 text-sm text-muted">
                Pick a problem and it shows up for {remoteName ?? "the candidate"} with starter code in the editor.
              </p>
            </div>
            <div className="w-full max-w-60">
              <ProblemPicker problems={problems} selectedSlug={selectedSlug} onPick={onPick} />
            </div>
          </>
        ) : (
          <div>
            <h3 className="text-xl">Hang tight</h3>
            <p className="mt-1 text-sm text-muted">
              {remoteName ?? "The interviewer"} will pick a problem. You can warm up in the editor in the meantime.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <article className="p-5">
      {isInterviewer && (
        <div className="mb-5">
          <ProblemPicker problems={problems} selectedSlug={selectedSlug} onPick={onPick} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <DifficultyBadge difficulty={problem.difficulty} />
        {problem.tags.map((t) => (
          <Badge key={t} tone="neutral">
            {t}
          </Badge>
        ))}
      </div>
      <h2 className="mt-3 text-2xl leading-tight">{problem.title}</h2>
      <div className="prose-brutal mt-4 text-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.description}</ReactMarkdown>
      </div>

      <h3 className="mt-6 flex items-center gap-2 text-xs font-heading uppercase tracking-widest">
        <ListChecks className="size-4" /> Examples
      </h3>
      <div className="mt-3 space-y-3">
        {problem.examples.map((ex, i) => (
          <div key={i} className="overflow-hidden rounded-base border-2 border-border">
            <div className="border-b-2 border-border bg-background px-3 py-1 text-xs font-heading">Example {i + 1}</div>
            <div className="grid grid-cols-2 divide-x-2 divide-border">
              <IO label="Input" value={problem.signature ? readableInput(problem.signature, ex.input) : ex.input} />
              <IO label="Output" value={problem.signature ? formatOutput(problem.signature.returns, ex.output) : ex.output} />
            </div>
            {ex.explanation && (
              <div className="border-t-2 border-border px-3 py-2 text-xs text-muted">{ex.explanation}</div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">
        + {problem.hiddenCount} hidden test{problem.hiddenCount === 1 ? "" : "s"} on Submit &middot; {problem.license}
        {problem.source?.name && (
          <>
            {" "}
            &middot;{" "}
            {problem.source.url ? (
              <a href={problem.source.url} target="_blank" rel="noreferrer" className="underline">
                {problem.source.name}
              </a>
            ) : (
              problem.source.name
            )}
          </>
        )}
      </p>
    </article>
  );
}

/** "nums = [2,7,11,15]" per parameter, from the raw stdin lines. */
function readableInput(sig: Signature, input: string): string {
  const lines = input.replace(/\n$/, "").split("\n");
  return sig.params.map((p, i) => `${p.name} = ${formatValue(p.type, lines[i] ?? "")}`).join("\n");
}

function IO({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 p-2">
      <div className="mb-1 text-[10px] font-heading uppercase tracking-wider text-muted">{label}</div>
      <pre className="max-h-32 overflow-auto font-mono text-xs leading-5 whitespace-pre-wrap break-all">{value.replace(/\n$/, "")}</pre>
    </div>
  );
}

function GuideTab({ problem, guide }: { problem: AnyProblem | null; guide: InterviewerProblem["interviewer"] | null }) {
  const [revealed, setRevealed] = useState(0);
  const [prevSlug, setPrevSlug] = useState(problem?.slug);
  if (problem?.slug !== prevSlug) {
    setPrevSlug(problem?.slug);
    setRevealed(0);
  }

  if (!problem || !guide) {
    return (
      <div className="p-6 text-center text-sm text-muted">Pick a problem to see hints, follow-ups and the expected complexity.</div>
    );
  }
  return (
    <div className="space-y-6 p-5">
      <div className="rounded-base border-2 border-border bg-accent-violet/30 p-3 text-xs">
        <span className="font-heading">Only you can see this.</span> The candidate&apos;s browser never loads this tab.
      </div>

      {guide.expectedComplexity && (
        <section>
          <SectionHead icon={<Gauge />} title="Expected complexity" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["time", "space"] as const).map((k) => (
              <div key={k} className="rounded-base border-2 border-border bg-background p-2">
                <div className="text-[10px] font-heading uppercase tracking-wider text-muted">{k}</div>
                <div className="font-mono text-sm font-bold">{guide.expectedComplexity![k]}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {guide.hints.length > 0 && (
        <section>
          <div className="flex items-center justify-between">
            <SectionHead icon={<Lightbulb />} title={`Hints (${revealed}/${guide.hints.length} shown)`} />
            <button
              className="flex items-center gap-1 text-xs font-heading underline underline-offset-4"
              onClick={() => setRevealed(revealed >= guide.hints.length ? 0 : guide.hints.length)}
            >
              {revealed >= guide.hints.length ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
              {revealed >= guide.hints.length ? "Hide all" : "Show all"}
            </button>
          </div>
          <ol className="mt-2 space-y-2">
            {guide.hints.map((h, i) => (
              <li key={i}>
                {i < revealed ? (
                  <div className="flex gap-2 rounded-base border-2 border-border bg-accent-yellow/40 p-2 text-sm">
                    <span className="font-heading">{i + 1}.</span>
                    {h}
                  </div>
                ) : i === revealed ? (
                  <button
                    onClick={() => setRevealed(i + 1)}
                    className="w-full rounded-base border-2 border-dashed border-border p-2 text-left text-sm font-heading hover:bg-background"
                  >
                    Reveal hint {i + 1}
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      )}

      {guide.followUps.length > 0 && (
        <section>
          <SectionHead icon={<Sparkles />} title="Follow-up questions" />
          <ul className="mt-2 space-y-2">
            {guide.followUps.map((f, i) => (
              <li key={i} className="flex gap-2 rounded-base border-2 border-border bg-background p-2 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rotate-45 border border-border bg-main" />
                {f}
              </li>
            ))}
          </ul>
        </section>
      )}

      {guide.notes && (
        <section>
          <SectionHead icon={<NotebookPen />} title="Author's notes" />
          <p className="mt-2 rounded-base border-2 border-border bg-background p-3 text-sm">{guide.notes}</p>
        </section>
      )}
    </div>
  );
}

function SectionHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-heading uppercase tracking-widest [&_svg]:size-4">
      {icon} {title}
    </h3>
  );
}

export type NotesProps = {
  text: string;
  onText: (t: string) => void;
  shared: boolean;
  onShared: (v: boolean) => void;
  saving: "idle" | "saving" | "saved" | "error";
  partnerNote: SharedNote | null;
};

function NotesTab({ notes, isInterviewer, remoteName }: { notes: NotesProps; isInterviewer: boolean; remoteName: string | null }) {
  const other = remoteName ?? (isInterviewer ? "the candidate" : "the interviewer");
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <label className="flex cursor-pointer items-center gap-3 rounded-base border-2 border-border bg-background p-2.5 text-xs">
        <input
          type="checkbox"
          className="size-4 accent-black"
          checked={notes.shared}
          onChange={(e) => notes.onShared(e.target.checked)}
        />
        <span className="min-w-0 flex-1">
          <span className="font-heading">{notes.shared ? `Shared with ${other}` : "Private"}</span>
          <span className="text-muted">
            {" "}
            &middot; {notes.shared ? "they can read these live and on the summary." : `saved to your account, never shown to ${other}.`}
          </span>
        </span>
        <span className="shrink-0 text-muted">
          {notes.saving === "saving" ? "Saving…" : notes.saving === "error" ? "Not saved" : notes.saving === "saved" ? "Saved" : ""}
        </span>
      </label>
      <Textarea
        value={notes.text}
        onChange={(e) => notes.onText(e.target.value)}
        placeholder={
          isInterviewer
            ? "• Asked clarifying questions?\n• Considered edge cases?\n• Talked through complexity?"
            : "Scratch space for your own thinking…"
        }
        className="min-h-48 flex-1 resize-none font-mono text-xs leading-5"
        maxLength={50_000}
      />
      {notes.partnerNote && notes.partnerNote.text.trim() && (
        <div className="max-h-[45%] min-h-24 overflow-y-auto rounded-base border-2 border-border bg-accent-blue/20 p-3 scrollbar-thin">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-heading uppercase tracking-wider">
            <Share2 className="size-3" /> {notes.partnerNote.name}&apos;s shared notes
          </div>
          <pre className="font-mono text-xs leading-5 whitespace-pre-wrap">{notes.partnerNote.text}</pre>
        </div>
      )}
    </div>
  );
}
