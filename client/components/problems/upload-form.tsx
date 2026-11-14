"use client";

import { Check, FileUp, FlaskConical, Rocket, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGE_IDS } from "@/lib/languages";
import type { RunResponse } from "@/lib/run-types";
import { cn } from "@/lib/utils";

const TEMPLATE = {
  slug: "sum-of-list",
  title: "Sum of a List",
  difficulty: "easy",
  tags: ["array"],
  license: "MIT",
  source: { name: "Your name or the original source" },
  description:
    "Given a list of integers, print their sum.\n\n### Input\nOne line of space-separated integers.\n\n### Output\nTheir sum.",
  examples: [{ input: "1 2 3\n", output: "6\n", explanation: "1 + 2 + 3 = 6" }],
  tests: [
    { input: "5\n", output: "5\n" },
    { input: "-1 1\n", output: "0\n" },
  ],
  starters: {
    python:
      'import sys\n\n\ndef solve(nums):\n    # Return the sum of nums.\n    return 0\n\n\ndef main():\n    nums = list(map(int, sys.stdin.read().split()))\n    print(solve(nums))\n\n\nif __name__ == "__main__":\n    main()\n',
    javascript:
      'function solve(nums) {\n  // Return the sum of nums.\n  return 0;\n}\n\nconst nums = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);\nconsole.log(solve(nums));\n',
  },
  interviewer: {
    hints: ["What's the simplest loop that works?"],
    followUps: ["What if the numbers don't fit in 64 bits?"],
    expectedComplexity: { time: "O(n)", space: "O(1)" },
  },
  reference: { language: "python", code: "import sys\nprint(sum(map(int, sys.stdin.read().split())))\n" },
};

type Issue = { path: string; message: string };
type Result =
  | { kind: "ok"; published: boolean; slug: string; verification: RunResponse }
  | { kind: "error"; message: string; issues?: Issue[]; verification?: RunResponse };

export function UploadForm() {
  const [text, setText] = useState(() => JSON.stringify(TEMPLATE, null, 2));
  const [busy, setBusy] = useState<"dry" | "publish" | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async (dryRun: boolean) => {
    let problem: unknown;
    try {
      problem = JSON.parse(text);
    } catch (e) {
      setResult({ kind: "error", message: `That isn't valid JSON: ${(e as Error).message}` });
      return;
    }
    setBusy(dryRun ? "dry" : "publish");
    setResult(null);
    try {
      const res = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem, dryRun }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ kind: "error", message: body.error ?? `Failed (${res.status})`, issues: body.issues, verification: body.verification });
      } else {
        setResult({ kind: "ok", published: body.published, slug: body.slug, verification: body.verification });
      }
    } catch {
      setResult({ kind: "error", message: "Network error" });
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setText(await f.text());
    setResult(null);
  };

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="overflow-hidden rounded-base border-4 border-border bg-secondary-background shadow-xl">
        <div className="flex flex-wrap items-center gap-2 border-b-4 border-border bg-background px-3 py-2">
          <span className="font-mono text-sm font-bold">problem.json</span>
          <div className="ml-auto flex gap-2">
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <Button size="sm" variant="neutral" onClick={() => fileRef.current?.click()}>
              <FileUp /> Load file
            </Button>
            <Button size="sm" variant="neutral" onClick={() => submit(true)} disabled={!!busy}>
              {busy === "dry" ? <Spinner /> : <FlaskConical />} Validate
            </Button>
            <Button size="sm" onClick={() => submit(false)} disabled={!!busy}>
              {busy === "publish" ? <Spinner /> : <Rocket />} Publish
            </Button>
          </div>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="h-[65vh] resize-none rounded-none border-0 font-mono text-xs leading-5 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>

      <aside className="space-y-4">
        {result && <ResultPanel result={result} />}
        <div className="rounded-base border-2 border-border bg-secondary-background p-5 shadow-shadow">
          <h2 className="text-lg">Format rules</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              ["slug", "lowercase-with-dashes, unique"],
              ["examples", "at least 1; shown to both people"],
              ["tests", "hidden; only the server reads them"],
              ["starters", "≥1 language; read stdin, call solve()"],
              ["license", "required (e.g. MIT, CC-BY-4.0)"],
              ["reference", "required; must pass every test"],
              ["interviewer", "hints, followUps, expectedComplexity"],
            ].map(([k, v]) => (
              <li key={k} className="flex gap-2">
                <code className="shrink-0 rounded-sm border-2 border-border bg-background px-1 font-mono text-xs font-bold">{k}</code>
                <span className="text-muted">{v}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">
            Output is compared line by line, ignoring trailing whitespace. Languages: {LANGUAGE_IDS.join(", ")}.
          </p>
        </div>
      </aside>
    </div>
  );
}

function ResultPanel({ result }: { result: Result }) {
  const v = result.verification;
  return (
    <div
      className={cn(
        "rounded-base border-2 border-border p-5 shadow-lg",
        result.kind === "ok" ? "bg-accent-green text-black" : "bg-accent-red text-black",
      )}
    >
      <div className="flex items-center gap-2 font-heading">
        {result.kind === "ok" ? <Check /> : <X />}
        {result.kind === "ok"
          ? result.published
            ? "Published!"
            : "Looks good. The reference passes everything."
          : result.message}
      </div>
      {result.kind === "ok" && result.published && (
        <Link href="/problems" className="mt-2 inline-block text-sm font-heading underline underline-offset-4">
          See it in the problem set →
        </Link>
      )}
      {result.kind === "error" && result.issues && (
        <ul className="mt-3 space-y-1 rounded-base border-2 border-border bg-secondary-background p-3 text-sm text-foreground">
          {result.issues.map((i, n) => (
            <li key={n}>
              <code className="font-mono font-bold">{i.path || "(root)"}</code>: {i.message}
            </li>
          ))}
        </ul>
      )}
      {v && (
        <div className="mt-3 rounded-base border-2 border-border bg-secondary-background p-3 text-sm text-foreground">
          {v.compileError ? (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs">{v.compileError}</pre>
          ) : (
            <>
              <div className="mb-2 font-heading">
                {v.summary.passed}/{v.summary.total} tests passed
              </div>
              <div className="flex flex-wrap gap-1">
                {v.results.map((r) => (
                  <Badge key={r.index} tone={r.passed ? "green" : "red"} title={r.statusText}>
                    {r.kind === "example" ? "ex" : "t"}
                    {r.index + 1}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
