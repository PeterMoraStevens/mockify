"use client";

import { AlertOctagon, Check, ChevronRight, FlaskConical, Lock, Terminal, X } from "lucide-react";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGES } from "@/lib/languages";
import type { RunState, Slot } from "@/lib/room/session-doc";
import type { TestResult } from "@/lib/run-types";
import { cn } from "@/lib/utils";

export function OutputPanel({
  run,
  slot,
  busy,
  tab,
  onTab,
  stdin,
  onStdin,
  hasProblem,
  runnerName,
}: {
  run: RunState;
  slot: Slot | null;
  busy: boolean;
  tab: "tests" | "custom";
  onTab: (t: "tests" | "custom") => void;
  stdin: string;
  onStdin: (s: string) => void;
  hasProblem: boolean;
  runnerName?: string;
}) {
  const last = run.last;
  const summary =
    last && !last.error && !last.compileError && last.mode !== "custom" ? last.summary : null;
  const allPass = summary && summary.total > 0 && summary.passed === summary.total;

  return (
    <section className="flex h-full min-h-0 flex-col rounded-base border-2 border-border bg-secondary-background shadow-lg">
      <Tabs
        className="bg-background"
        value={hasProblem ? tab : "custom"}
        onChange={onTab}
        items={[
          { value: "tests", label: "Test results", icon: <FlaskConical />, hidden: !hasProblem },
          { value: "custom", label: hasProblem ? "Custom input" : "Output", icon: <Terminal /> },
        ]}
        right={
          busy ? (
            <span className="flex items-center gap-2 text-xs font-heading">
              <Spinner /> {runnerName ? `${runnerName} is running…` : "Running…"}
            </span>
          ) : summary ? (
            <span
              className={cn(
                "rounded-base border-2 border-border px-2 py-0.5 text-xs font-heading text-black",
                allPass ? "bg-accent-green" : "bg-accent-red",
              )}
            >
              {summary.passed}/{summary.total} passed
            </span>
          ) : null
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {tab === "tests" && hasProblem ? (
          <TestsView run={run} slot={slot} />
        ) : (
          <CustomView run={run} stdin={stdin} onStdin={onStdin} hasProblem={hasProblem} />
        )}
      </div>
    </section>
  );
}

function RunMeta({ run, slot }: { run: RunState; slot: Slot | null }) {
  const last = run.last!;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
      <span className="rounded-sm border-2 border-border bg-background px-1.5 font-heading uppercase text-foreground">
        {last.mode === "submit" ? "Submit" : last.mode === "run" ? "Run" : "Custom run"}
      </span>
      {LANGUAGES[last.language]?.label} &middot; by {last.by === slot ? "you" : last.byName} &middot;{" "}
      {new Date(last.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </div>
  );
}

function ErrorBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="overflow-hidden rounded-base border-2 border-border">
      <div className="flex items-center gap-2 border-b-2 border-border bg-accent-red px-3 py-1.5 text-sm font-heading text-black">
        <AlertOctagon className="size-4" /> {title}
      </div>
      <pre className="max-h-64 overflow-auto bg-background p-3 font-mono text-xs leading-5 whitespace-pre-wrap">{body}</pre>
    </div>
  );
}

function TestsView({ run, slot }: { run: RunState; slot: Slot | null }) {
  const last = run.last && run.last.mode !== "custom" ? run.last : null;
  if (!last) {
    return (
      <Empty>
        <b>Run</b> checks the visible examples. <b>Submit</b> also runs the hidden tests on the server.
      </Empty>
    );
  }
  if (last.error) return <div className="p-4"><ErrorBlock title="Couldn't run" body={last.error} /></div>;
  if (last.compileError) {
    return (
      <div className="p-4">
        <RunMeta run={run} slot={slot} />
        <ErrorBlock title="Compilation error" body={last.compileError} />
      </div>
    );
  }

  const examples = last.results.filter((r) => r.kind === "example");
  const hidden = last.results.filter((r) => r.kind === "hidden");
  return (
    <div className="p-4">
      <RunMeta run={run} slot={slot} />
      <div className="space-y-2">
        {examples.map((r) => (
          <ExampleResult key={r.index} r={r} defaultOpen={!r.passed} />
        ))}
      </div>
      {hidden.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-heading uppercase tracking-widest">
            <Lock className="size-3.5" /> Hidden tests &middot; {hidden.filter((h) => h.passed).length}/{hidden.length}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {hidden.map((r, i) => (
              <span
                key={r.index}
                title={`${r.statusText}${r.timeMs !== null ? ` · ${r.timeMs}ms` : ""}`}
                className={cn(
                  "grid h-7 min-w-9 place-items-center rounded-sm border-2 border-border px-1 font-mono text-[11px] font-bold text-black",
                  r.passed ? "bg-accent-green" : "bg-accent-red",
                )}
              >
                {i + 1}
              </span>
            ))}
          </div>
          {hidden.some((h) => !h.passed) && (
            <p className="mt-2 text-xs text-muted">
              First failure: {hidden.find((h) => !h.passed)!.statusText}. Hidden inputs aren&apos;t shown, so look for edge cases.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ExampleResult({ r, defaultOpen }: { r: TestResult; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-base border-2 border-border">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-heading text-black",
          r.passed ? "bg-accent-green" : "bg-accent-red",
        )}
      >
        {r.passed ? <Check className="size-4" strokeWidth={3} /> : <X className="size-4" strokeWidth={3} />}
        Example {r.index + 1}
        <span className="font-base opacity-80">&middot; {r.statusText}</span>
        <span className="ml-auto font-mono text-xs opacity-80">
          {r.timeMs !== null && `${r.timeMs}ms`}
          {r.memoryKb !== null && ` · ${(r.memoryKb / 1024).toFixed(1)}MB`}
        </span>
        <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="grid gap-px bg-border sm:grid-cols-3">
          <Cell label="Input" value={r.input ?? ""} />
          <Cell label="Expected" value={r.expected ?? ""} />
          <Cell label="Your output" value={r.stdout ?? ""} bad={!r.passed} />
          {r.stderr && (
            <div className="sm:col-span-3">
              <Cell label="stderr" value={r.stderr} bad />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="min-w-0 bg-secondary-background p-2">
      <div className={cn("mb-1 text-[10px] font-heading uppercase tracking-wider", bad ? "text-accent-red" : "text-muted")}>{label}</div>
      <pre className="max-h-40 overflow-auto font-mono text-xs leading-5 whitespace-pre-wrap break-all">
        {value === "" ? <span className="italic opacity-50">(empty)</span> : value.replace(/\n$/, "")}
      </pre>
    </div>
  );
}

function CustomView({
  run,
  stdin,
  onStdin,
  hasProblem,
}: {
  run: RunState;
  stdin: string;
  onStdin: (s: string) => void;
  hasProblem: boolean;
}) {
  const last = run.last && run.last.mode === "custom" ? run.last : null;
  const c = last?.custom;
  return (
    <div className="grid h-full gap-3 p-4 md:grid-cols-2">
      <div className="flex min-h-32 flex-col">
        <div className="mb-1 text-[10px] font-heading uppercase tracking-wider text-muted">stdin</div>
        <Textarea
          value={stdin}
          onChange={(e) => onStdin(e.target.value)}
          placeholder={hasProblem ? "Paste an input here, then hit Run." : "Input for your program (optional)"}
          className="flex-1 resize-none font-mono text-xs leading-5"
          spellCheck={false}
        />
      </div>
      <div className="flex min-h-32 min-w-0 flex-col">
        <div className="mb-1 flex items-center gap-2 text-[10px] font-heading uppercase tracking-wider text-muted">
          stdout
          {c && (
            <span className="ml-auto font-mono normal-case tracking-normal">
              {c.statusText}
              {c.timeMs !== null && ` · ${c.timeMs}ms`}
            </span>
          )}
        </div>
        {last?.error ? (
          <ErrorBlock title="Couldn't run" body={last.error} />
        ) : last?.compileError ? (
          <ErrorBlock title="Compilation error" body={last.compileError} />
        ) : (
          <pre className="min-h-24 flex-1 overflow-auto rounded-base border-2 border-border bg-background p-2 font-mono text-xs leading-5 whitespace-pre-wrap">
            {c ? (
              <>
                {c.stdout}
                {c.stderr && <span className="text-accent-red">{c.stderr}</span>}
                {!c.stdout && !c.stderr && <span className="italic opacity-50">(no output)</span>}
              </>
            ) : (
              <span className="italic opacity-50">Output shows up here. ⌘/Ctrl + Enter runs.</span>
            )}
          </pre>
        )}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">{<p className="max-w-xs">{children}</p>}</div>;
}
