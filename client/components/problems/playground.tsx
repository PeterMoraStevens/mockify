"use client";

import { Check, Play, RotateCcw, Send, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { LANGUAGES, type LanguageId } from "@/lib/languages";
import { formatOutput, readableInput, type Signature } from "@/lib/problems/starters";
import type { RunResponse } from "@/lib/run-types";
import { cn } from "@/lib/utils";
import { PlainEditor } from "./plain-editor";

const key = (slug: string, lang: string) => `mockify:practice:${slug}:${lang}`;
const load = (slug: string, lang: string) => {
  try {
    return localStorage.getItem(key(slug, lang));
  } catch {
    return null;
  }
};
const save = (slug: string, lang: string, code: string) => {
  try {
    localStorage.setItem(key(slug, lang), code);
  } catch {}
};

/**
 * Solo practice outside a room: edit, Run against the examples, Submit
 * against the hidden tests. Only rendered for signed-in users, and /api/run
 * refuses anyone else. Code is kept in this browser per problem and language.
 */
export function Playground({
  slug,
  starters,
  languages,
  signature,
}: {
  slug: string;
  starters: Partial<Record<LanguageId, string>>;
  languages: LanguageId[];
  signature: Signature | null;
}) {
  const [lang, setLang] = useState<LanguageId>(languages.includes("python") ? "python" : languages[0]);
  const [code, setCode] = useState(starters[lang] ?? "");
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Restore saved code (after mount: no localStorage on the server).
  useEffect(() => {
    setCode(load(slug, lang) ?? starters[lang] ?? "");
  }, [slug, lang, starters]);

  const onChange = (v: string) => {
    setCode(v);
    save(slug, lang, v);
  };

  const run = useCallback(
    async (mode: "run" | "submit") => {
      if (busy) return;
      setBusy(mode);
      setError(null);
      try {
        const r = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, slug, language: lang, code }),
        });
        const b = await r.json().catch(() => ({}));
        if (!r.ok) {
          setResult(null);
          setError(r.status === 401 ? "Your session expired. Sign in again to run code." : (b.error ?? `Failed (${r.status})`));
          return;
        }
        setResult(b as RunResponse);
      } catch {
        setError("Network error");
      } finally {
        setBusy(null);
      }
    },
    [busy, slug, lang, code],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        run(e.shiftKey ? "submit" : "run");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  const reset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      window.setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    setConfirmReset(false);
    onChange(starters[lang] ?? "");
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-base border-4 border-border bg-secondary-background shadow-xl">
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-border bg-background p-2">
        <span className="px-1 font-heading">Practice</span>
        <Select value={lang} onValueChange={(v) => setLang(v as LanguageId)}>
          <SelectTrigger className="h-8 w-40 bg-secondary-background" aria-label="Language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages.map((l) => (
              <SelectItem key={l} value={l}>
                {LANGUAGES[l].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="neutral" className="h-8" onClick={reset} title="Replace your code with the starter">
          <RotateCcw /> {confirmReset ? "Sure?" : "Reset"}
        </Button>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="neutral" className="h-8 bg-accent-green text-black" onClick={() => run("run")} disabled={!!busy} title="Run the examples (⌘/Ctrl + Enter)">
            {busy === "run" ? <Spinner /> : <Play />} Run
          </Button>
          <Button size="sm" className="h-8" onClick={() => run("submit")} disabled={!!busy} title="Submit against the hidden tests (⌘/Ctrl + Shift + Enter)">
            {busy === "submit" ? <Spinner /> : <Send />} Submit
          </Button>
        </div>
      </div>

      <PlainEditor value={code} onChange={onChange} language={lang} className="h-[28rem] overflow-auto border-b-2 border-border text-sm" />

      <div className="max-h-[22rem] min-h-28 overflow-auto p-3" aria-live="polite">
        {error ? (
          <p className="rounded-base border-2 border-border bg-accent-red px-3 py-2 text-sm text-black">{error}</p>
        ) : !result ? (
          <p className="py-6 text-center text-sm text-muted">Run checks the examples. Submit also runs the hidden tests.</p>
        ) : result.compileError ? (
          <div>
            <Badge tone="red">Compile error</Badge>
            <pre className="mt-2 overflow-auto rounded-base border-2 border-border bg-background p-2 font-mono text-xs whitespace-pre-wrap">{result.compileError}</pre>
          </div>
        ) : (
          <Results result={result} signature={signature} />
        )}
      </div>
    </div>
  );
}

function Results({ result, signature }: { result: RunResponse; signature: Signature | null }) {
  const { passed, total } = result.summary;
  const all = passed === total;
  return (
    <div>
      <div className="flex items-center gap-2">
        <Badge tone={all ? "green" : "red"} shadow>
          {all ? "Accepted" : "Not yet"}
        </Badge>
        <span className="text-sm font-heading">
          {passed}/{total} {result.mode === "submit" ? "tests" : "examples"} passed
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {result.results.map((t) => (
          <li key={`${t.kind}-${t.index}`} className="rounded-base border-2 border-border bg-background p-2 text-xs">
            <div className="flex items-center gap-2">
              <span className={cn("grid size-5 place-items-center rounded-full border-2 border-border text-black", t.passed ? "bg-accent-green" : "bg-accent-red")}>
                {t.passed ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
              </span>
              <span className="font-heading">
                {t.kind === "example" ? `Example ${t.index + 1}` : `Hidden test ${t.index + 1}`}
              </span>
              <span className="text-muted">{t.passed ? "" : t.statusText}</span>
              {t.timeMs !== null && <span className="ml-auto text-muted">{t.timeMs} ms</span>}
            </div>
            {!t.passed && t.input !== undefined && (
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Pre label="Input" value={signature ? readableInput(signature, t.input) : t.input} />
                <Pre label="Expected" value={signature && t.expected ? formatOutput(signature.returns, t.expected) : (t.expected ?? "")} />
                <Pre label="Your output" value={t.stdout ?? ""} />
              </div>
            )}
            {!t.passed && t.stderr && <Pre label="stderr" value={t.stderr} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pre({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 text-[10px] font-heading uppercase tracking-wider text-muted">{label}</div>
      <pre className="max-h-28 overflow-auto rounded-sm border border-border/50 p-1 font-mono whitespace-pre-wrap break-all">{value.replace(/\n$/, "")}</pre>
    </div>
  );
}
