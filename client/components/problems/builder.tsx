"use client";

import {
  AlertTriangle,
  Braces,
  Copy,
  FlaskConical,
  Lightbulb,
  ListChecks,
  Lock,
  Plus,
  Rocket,
  RotateCcw,
  Sparkles,
  SquareFunction,
  Trash2,
  Type,
  Wand2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGE_IDS, LANGUAGES, isLanguageId, type LanguageId } from "@/lib/languages";
import {
  emptyState,
  fromProblem,
  problemsWith,
  resizeCases,
  slugify,
  toInput,
  toProblem,
  type BuilderCase,
  type BuilderState,
} from "@/lib/problems/builder";
import type { Problem } from "@/lib/problems/schema";
import type { RunResponse } from "@/lib/run-types";
import {
  BASE_TYPES,
  MAX_PARAM_DEPTH,
  MAX_RETURN_DEPTH,
  generateStarter,
  ioSection,
  makeType,
  parseType,
  typeLabel,
  validateSignature,
  type BaseType,
  type Signature,
} from "@/lib/problems/starters";
import { cn } from "@/lib/utils";
import { PlainEditor } from "./plain-editor";
import { ResultPanel, type Result } from "./upload-form";

type SaveState = "idle" | "saving" | "saved" | "error";
const DRAFT_DEBOUNCE_MS = 1500;

const BASE_PLACEHOLDER: Record<BaseType, [string, string, string]> = {
  int: ["42", "3 1 4 1 5", "[[1,2],[3]]"],
  long: ["9000000000", "1 20000000000 3", "[[1,2],[3]]"],
  bool: ["true", "true false true", "[[true],[false,true]]"],
  string: ["hello world", "apple banana cherry", '[["ab","cd"],["ef"]]'],
};
const placeholder = (type: string) => {
  const t = parseType(type) ?? { base: "int" as BaseType, depth: 0 };
  return BASE_PLACEHOLDER[t.base][Math.min(t.depth, 2)];
};

const BASE_NAMES: Record<BaseType, string> = { int: "int", long: "long (64-bit)", bool: "bool", string: "string" };

/**
 * A type built one step at a time: each dropdown is either a data type or
 * "array of…", and choosing "array of…" opens another dropdown for what the
 * array holds. So int[][] is: array of… → array of… → int.
 */
function TypePicker({ value, onChange, maxDepth, label }: { value: string; onChange: (t: string) => void; maxDepth: number; label: string }) {
  const t = parseType(value) ?? { base: "int" as BaseType, depth: 0 };
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" aria-label={`${label} type`} role="group">
      {Array.from({ length: t.depth + 1 }, (_, level) => {
        const isArray = level < t.depth;
        return (
          <div key={level} className="flex items-center gap-1.5">
            {level > 0 && <span className="text-xs text-muted" aria-hidden>→</span>}
            <Select
              value={isArray ? "array" : t.base}
              onValueChange={(v) =>
                onChange(v === "array" ? makeType(t.base, level + 1) : makeType(v as BaseType, level))
              }
            >
              <SelectTrigger className="h-9 w-32" aria-label={level === 0 ? `${label} type` : `${label} element type, level ${level}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BASE_TYPES.map((b) => (
                  <SelectItem key={b} value={b}>
                    {BASE_NAMES[b]}
                  </SelectItem>
                ))}
                <SelectItem value="array" disabled={level >= maxDepth}>
                  array of…{level >= maxDepth ? " (max depth)" : ""}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      })}
      <code className="ml-1 rounded-base border-2 border-border bg-background px-1.5 py-0.5 font-mono text-xs">{value}</code>
    </div>
  );
}

/** toProblem, but a bad test value leaves that input empty instead of throwing (problemsWith reports it). */
function safeProblem(s: BuilderState) {
  try {
    return toProblem(s);
  } catch {
    return toProblem({ ...s, examples: [], tests: [] });
  }
}

export function ProblemBuilder() {
  const router = useRouter();
  const params = useSearchParams();
  const [s, setS] = useState<BuilderState>(emptyState);
  const [loading, setLoading] = useState(() => !!(params.get("draft") || params.get("edit")));
  const [draftId, setDraftId] = useState<string | null>(params.get("draft"));
  const [editing, setEditing] = useState<string | null>(params.get("edit"));
  const [save, setSave] = useState<SaveState>("idle");
  const [busy, setBusy] = useState<"outputs" | "validate" | "publish" | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [preview, setPreview] = useState(false);
  const [starterLang, setStarterLang] = useState<LanguageId>("python");
  const dirty = useRef(false);

  const update = useCallback((patch: Partial<BuilderState> | ((p: BuilderState) => Partial<BuilderState>)) => {
    dirty.current = true;
    setS((prev) => ({ ...prev, ...(typeof patch === "function" ? patch(prev) : patch) }));
  }, []);

  // ------------------------------------------------------------ loading
  useEffect(() => {
    const draft = params.get("draft");
    const edit = params.get("edit");
    if (!draft && !edit) return;
    let cancelled = false;
    (async () => {
      try {
        if (draft) {
          const r = await fetch(`/api/drafts/${draft}`, { cache: "no-store" });
          if (!r.ok) throw new Error("That draft doesn't exist anymore.");
          const d = (await r.json()) as { data: { state?: BuilderState; editing?: string | null } };
          if (!cancelled && d.data.state) {
            setS({ ...emptyState(), ...d.data.state });
            setEditing(d.data.editing ?? null);
          }
        } else if (edit) {
          const r = await fetch(`/api/problems/${edit}?view=source`, { cache: "no-store" });
          if (!r.ok) throw new Error("You can only edit problems you published.");
          const st = fromProblem((await r.json()) as Problem);
          if (!st) throw new Error("This problem was uploaded as JSON, so it can't be opened in the builder.");
          if (!cancelled) setS(st);
        }
      } catch (e) {
        toast.error((e as Error).message);
        setDraftId(null);
        setEditing(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Load once, from the URL we arrived with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------- drafts
  useEffect(() => {
    if (loading || !dirty.current) return;
    if (!draftId && !s.title.trim() && !s.statement.trim()) return;
    const t = window.setTimeout(async () => {
      setSave("saving");
      const body = JSON.stringify({ title: s.title || "Untitled problem", data: { state: s, editing } });
      try {
        if (draftId) {
          const r = await fetch(`/api/drafts/${draftId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body });
          setSave(r.ok ? "saved" : "error");
        } else {
          const r = await fetch("/api/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body });
          const b = await r.json().catch(() => ({}));
          if (!r.ok) {
            setSave("error");
            toast.error(b.error ?? "Couldn't save a draft");
            return;
          }
          setDraftId(b.id);
          window.history.replaceState(null, "", `/problems/new?draft=${b.id}`);
          setSave("saved");
        }
      } catch {
        setSave("error");
      }
    }, DRAFT_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [s, draftId, editing, loading]);

  const discardDraft = async () => {
    if (draftId) await fetch(`/api/drafts/${draftId}`, { method: "DELETE" }).catch(() => {});
    router.push("/problems/library");
  };

  // ---------------------------------------------------------- signature
  const setSignature = (sig: Signature) =>
    update((p) => ({
      signature: sig,
      examples: resizeCases(p.examples, sig.params.length),
      tests: resizeCases(p.tests, sig.params.length),
      ...(p.referencePristine ? { referenceCode: generateStarter(p.referenceLanguage, sig, p.doc) } : {}),
    }));
  const sigError = validateSignature(s.signature);

  // -------------------------------------------------------------- cases
  const setCase = (list: "examples" | "tests", i: number, patch: Partial<BuilderCase>) =>
    update((p) => ({ [list]: p[list].map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const addCase = (list: "examples" | "tests", from?: BuilderCase) =>
    update((p) => ({
      [list]: [...p[list], from ? { ...from, values: [...from.values] } : { values: Array(p.signature.params.length).fill(""), output: "", explanation: "" }],
    }));
  const removeCase = (list: "examples" | "tests", i: number) => update((p) => ({ [list]: p[list].filter((_, j) => j !== i) }));

  // ------------------------------------------------------------ actions
  const fillOutputs = async () => {
    const all = [...s.examples, ...s.tests];
    if (!all.length) return;
    try {
      all.forEach((c) => toInput(c, s.signature));
    } catch (e) {
      return void toast.error((e as Error).message);
    }
    setBusy("outputs");
    try {
      const r = await fetch("/api/problems/outputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: s.referenceLanguage, code: s.referenceCode, inputs: all.map((c) => toInput(c, s.signature)) }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) return void toast.error(b.error ?? "Couldn't run the reference");
      if (b.compileError) return void toast.error("The reference didn't compile", { description: String(b.compileError).slice(0, 300) });
      const res = b.results as { ok: boolean; statusText: string; stdout: string; stderr: string }[];
      const failed = res.findIndex((x) => !x.ok);
      const out = (i: number) => (res[i].ok ? res[i].stdout.replace(/\s+$/, "") : null);
      update((p) => ({
        examples: p.examples.map((c, i) => ({ ...c, output: out(i) ?? c.output })),
        tests: p.tests.map((c, i) => ({ ...c, output: out(p.examples.length + i) ?? c.output })),
      }));
      if (failed >= 0) {
        const where = failed < s.examples.length ? `example ${failed + 1}` : `hidden test ${failed - s.examples.length + 1}`;
        toast.error(`The reference failed on ${where}: ${res[failed].statusText}`, { description: res[failed].stderr.slice(0, 300) || undefined });
      } else {
        toast.success(`Filled ${res.length} outputs`);
      }
    } finally {
      setBusy(null);
    }
  };

  const submit = async (dryRun: boolean) => {
    setBusy(dryRun ? "validate" : "publish");
    setResult(null);
    try {
      const res = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          dryRun
            ? { problem: safeProblem(s), dryRun }
            : { problem: safeProblem(s), verifyToken: isVerified ? verified.token : undefined },
        ),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (dryRun || body.needsVerification) setVerified(null);
        setResult({ kind: "error", message: body.error ?? `Failed (${res.status})`, issues: body.issues, verification: body.verification });
        return;
      }
      if (dryRun) setVerified({ token: body.verifyToken, key: currentKey, verification: body.verification });
      setResult({ kind: "ok", published: body.published, slug: body.slug, verification: body.verification ?? verified?.verification });
      if (body.published) {
        toast.success(editing ? "Problem updated" : "Problem published");
        if (draftId) await fetch(`/api/drafts/${draftId}`, { method: "DELETE" }).catch(() => {});
        setDraftId(null);
        dirty.current = false;
        window.history.replaceState(null, "", `/problems/new?edit=${body.slug}`);
        setEditing(body.slug);
      }
    } catch {
      setResult({ kind: "error", message: "Network error" });
    } finally {
      setBusy(null);
    }
  };

  const issues = problemsWith(s);
  // Publishing needs a passing check of exactly what's on screen now (the
  // server enforces this too). Any edit after checking means checking again.
  const currentKey = useMemo(() => JSON.stringify(safeProblem(s)), [s]);
  const [verified, setVerified] = useState<{ token: string; key: string; verification: RunResponse } | null>(null);
  const isVerified = verified?.key === currentKey;
  const [jsonOpen, setJsonOpen] = useState(false);
  const problemJson = useMemo(() => (jsonOpen ? JSON.stringify(safeProblem(s), null, 2) : ""), [jsonOpen, s]);
  const starterPreview = useMemo(
    () => (sigError ? "" : generateStarter(starterLang, s.signature, s.doc || "Return the answer.")),
    [starterLang, s.signature, s.doc, sigError],
  );

  if (loading) {
    return (
      <div className="grid h-64 place-items-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        {/* ------------------------------------------------------ basics */}
        <Card icon={<Type />} title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title">
              <Input
                value={s.title}
                onChange={(e) => update((p) => ({ title: e.target.value, ...(p.slugEdited || editing ? {} : { slug: slugify(e.target.value) }) }))}
                placeholder="Two Sum"
                maxLength={120}
              />
            </Field>
            <Field label="URL name" hint={editing ? "Can't change while editing a published problem." : "Used in links. Must be unique."}>
              <Input
                value={s.slug}
                disabled={!!editing}
                onChange={(e) => update({ slug: slugify(e.target.value), slugEdited: true })}
                placeholder="two-sum"
                className="font-mono"
              />
            </Field>
            <Field label="Difficulty">
              <div className="grid grid-cols-3 gap-2">
                {(["easy", "medium", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => update({ difficulty: d })}
                    className={cn(
                      "h-10 rounded-base border-2 border-border font-heading capitalize transition-all",
                      s.difficulty === d
                        ? cn(d === "easy" ? "bg-accent-green" : d === "medium" ? "bg-accent-yellow" : "bg-accent-red", "text-black")
                        : "bg-background shadow-shadow hover:bg-secondary-background",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Tags" hint="Comma separated.">
              <Input value={s.tags} onChange={(e) => update({ tags: e.target.value })} placeholder="array, hash-map" />
            </Field>
            <Field label="License">
              <Input value={s.license} onChange={(e) => update({ license: e.target.value })} placeholder="MIT" />
            </Field>
            <Field label="Source (optional)" hint="Credit where the problem came from.">
              <div className="flex gap-2">
                <Input value={s.sourceName} onChange={(e) => update({ sourceName: e.target.value })} placeholder="Name" />
                <Input value={s.sourceUrl} onChange={(e) => update({ sourceUrl: e.target.value })} placeholder="https://…" />
              </div>
            </Field>
          </div>
        </Card>

        {/* --------------------------------------------------- statement */}
        <Card
          icon={<ListChecks />}
          title="Statement"
          right={
            <Button size="sm" variant="neutral" onClick={() => setPreview((v) => !v)}>
              {preview ? "Edit" : "Preview"}
            </Button>
          }
        >
          {preview ? (
            <div className="prose-brutal rounded-base border-2 border-border bg-background p-4 text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{safeProblem(s).description}</ReactMarkdown>
            </div>
          ) : (
            <div className="space-y-4">
              <Field label="Problem statement" hint="Markdown. The input/output format is added for you from the function signature.">
                <Textarea
                  value={s.statement}
                  onChange={(e) => update({ statement: e.target.value })}
                  className="min-h-40 font-mono text-xs leading-5"
                  placeholder={"Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`."}
                />
              </Field>
              <Field label="Constraints" hint="One per line.">
                <Textarea
                  value={s.constraints}
                  onChange={(e) => update({ constraints: e.target.value })}
                  className="min-h-24 font-mono text-xs leading-5"
                  placeholder={"`2 <= nums.length <= 10^4`\n`-10^9 <= nums[i] <= 10^9`"}
                />
              </Field>
            </div>
          )}
        </Card>

        {/* --------------------------------------------------- signature */}
        <Card icon={<SquareFunction />} title="Function signature">
          <p className="-mt-1 mb-4 text-sm text-muted">
            Candidates fill in a <code className="font-mono">solve()</code> function. Mockify writes the code that reads the input and
            prints the answer in every language.
          </p>
          <div className="space-y-2">
            {s.signature.params.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <span className="w-16 shrink-0 text-xs font-heading text-muted">Line {i + 1}</span>
                <Input
                  value={p.name}
                  onChange={(e) =>
                    setSignature({ ...s.signature, params: s.signature.params.map((q, j) => (j === i ? { ...q, name: e.target.value.replace(/[^A-Za-z0-9]/g, "") } : q)) })
                  }
                  className="w-36 shrink-0 font-mono"
                  placeholder="nums"
                  maxLength={30}
                />
                <TypePicker
                  value={p.type}
                  label={p.name || `Parameter ${i + 1}`}
                  maxDepth={MAX_PARAM_DEPTH}
                  onChange={(v) => setSignature({ ...s.signature, params: s.signature.params.map((q, j) => (j === i ? { ...q, type: v } : q)) })}
                />
                <Button
                  size="icon"
                  variant="neutral"
                  disabled={s.signature.params.length <= 1}
                  onClick={() => setSignature({ ...s.signature, params: s.signature.params.filter((_, j) => j !== i) })}
                  title="Remove parameter"
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="neutral"
              disabled={s.signature.params.length >= 6}
              onClick={() => setSignature({ ...s.signature, params: [...s.signature.params, { name: `arg${s.signature.params.length + 1}`, type: "int" }] })}
            >
              <Plus /> Add parameter
            </Button>
          </div>
          <div className="mt-5 grid gap-4">
            <Field label="Returns">
              <TypePicker value={s.signature.returns} label="Return" maxDepth={MAX_RETURN_DEPTH} onChange={(v) => setSignature({ ...s.signature, returns: v })} />
              <p className="mt-1 text-xs text-muted">{typeLabel(s.signature.returns)}</p>
            </Field>
            <Field label="What solve() returns" hint="One sentence, shown as a comment in the starter code.">
              <Input
                value={s.doc}
                onChange={(e) =>
                  update((p) => ({
                    doc: e.target.value,
                    ...(p.referencePristine && !sigError ? { referenceCode: generateStarter(p.referenceLanguage, p.signature, e.target.value) } : {}),
                  }))
                }
                placeholder="Return the indices of the two numbers that add up to target."
                maxLength={200}
              />
            </Field>
          </div>
          {sigError ? (
            <p className="mt-4 flex items-center gap-2 rounded-base border-2 border-border bg-accent-red/30 p-2 text-sm">
              <AlertTriangle className="size-4" /> {sigError}
            </p>
          ) : (
            <div className="prose-brutal mt-4 rounded-base border-2 border-dashed border-border bg-background p-3 text-xs">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{ioSection(s.signature)}</ReactMarkdown>
            </div>
          )}
        </Card>

        {/* ---------------------------------------------------- examples */}
        <Card icon={<FlaskConical />} title={`Examples (${s.examples.length})`} right={<span className="text-xs text-muted">Shown to both people</span>}>
          <CaseList
            list="examples"
            cases={s.examples}
            signature={s.signature}
            onChange={setCase}
            onAdd={addCase}
            onRemove={removeCase}
            explanations
            max={10}
          />
        </Card>

        <Card icon={<Lock />} title={`Hidden tests (${s.tests.length})`} right={<span className="text-xs text-muted">Only run on Submit</span>}>
          <CaseList list="tests" cases={s.tests} signature={s.signature} onChange={setCase} onAdd={addCase} onRemove={removeCase} max={100} />
        </Card>

        {/* --------------------------------------------------- reference */}
        <Card
          icon={<Wand2 />}
          title="Reference solution"
          right={
            <div className="flex items-center gap-2">
              <Select
                value={s.referenceLanguage}
                onValueChange={(v) =>
                  isLanguageId(v) &&
                  update((p) => ({
                    referenceLanguage: v,
                    ...(p.referencePristine && !sigError ? { referenceCode: generateStarter(v, p.signature, p.doc) } : {}),
                  }))
                }
              >
                <SelectTrigger className="h-8 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_IDS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {LANGUAGES[l].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="neutral"
                className="h-8"
                disabled={!!sigError}
                onClick={() => update((p) => ({ referenceCode: generateStarter(p.referenceLanguage, p.signature, p.doc), referencePristine: true }))}
                title="Replace with the starter code"
              >
                <RotateCcw /> Starter
              </Button>
            </div>
          }
        >
          <p className="-mt-1 mb-3 text-sm text-muted">
            Fill in <code className="font-mono">solve()</code>. It has to pass every test before the problem is published, and it can work out the
            expected outputs for you.
          </p>
          <div className="overflow-hidden rounded-base border-2 border-border">
            <PlainEditor
              value={s.referenceCode}
              onChange={(v) => update({ referenceCode: v, referencePristine: false })}
              language={s.referenceLanguage}
              className="cm-host h-96"
            />
          </div>
        </Card>

        {/* ----------------------------------------------- interviewer */}
        <Card icon={<Lightbulb />} title="Interviewer guide" right={<span className="text-xs text-muted">Only the interviewer sees this</span>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Hints" hint="One per line, revealed in order.">
              <Textarea value={s.hints} onChange={(e) => update({ hints: e.target.value })} className="min-h-28 text-sm" />
            </Field>
            <Field label="Follow-up questions" hint="One per line.">
              <Textarea value={s.followUps} onChange={(e) => update({ followUps: e.target.value })} className="min-h-28 text-sm" />
            </Field>
            <Field label="Expected time complexity">
              <Input value={s.time} onChange={(e) => update({ time: e.target.value })} placeholder="O(n)" />
            </Field>
            <Field label="Expected space complexity">
              <Input value={s.space} onChange={(e) => update({ space: e.target.value })} placeholder="O(n)" />
            </Field>
          </div>
          <Field label="Notes for the interviewer" className="mt-4">
            <Textarea value={s.notes} onChange={(e) => update({ notes: e.target.value })} className="min-h-20 text-sm" placeholder="Common pitfalls, what a strong answer looks like…" />
          </Field>
        </Card>

        {/* --------------------------------------------------- starters */}
        <Card icon={<Sparkles />} title="Starter code" right={<span className="text-xs text-muted">{s.languages.length} languages</span>}>
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGE_IDS.map((l) => {
              const on = s.languages.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => update((p) => ({ languages: on ? p.languages.filter((x) => x !== l) : LANGUAGE_IDS.filter((x) => x === l || p.languages.includes(x)) }))}
                  className={cn("rounded-base border-2 border-border px-2 py-0.5 text-xs font-heading", on ? "bg-main text-black" : "bg-background opacity-60")}
                >
                  {LANGUAGES[l].label}
                </button>
              );
            })}
          </div>
          {!sigError && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-heading text-muted">Preview</span>
                <Select value={starterLang} onValueChange={(v) => isLanguageId(v) && setStarterLang(v)}>
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_IDS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {LANGUAGES[l].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="overflow-hidden rounded-base border-2 border-border">
                <PlainEditor key={starterLang} value={starterPreview} language={starterLang} readOnly className="cm-host max-h-80 overflow-auto" />
              </div>
            </div>
          )}
        </Card>

        <details className="rounded-base border-2 border-border bg-secondary-background p-4 shadow-shadow" onToggle={(e) => setJsonOpen((e.target as HTMLDetailsElement).open)}>
          <summary className="flex cursor-pointer items-center gap-2 font-heading">
            <Braces className="size-4" /> Generated JSON
          </summary>
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="neutral"
              onClick={async () => {
                await navigator.clipboard.writeText(JSON.stringify(safeProblem(s), null, 2));
                toast.success("Copied");
              }}
            >
              <Copy /> Copy
            </Button>
          </div>
          <pre className="mt-2 max-h-96 overflow-auto rounded-base border-2 border-border bg-background p-3 font-mono text-[11px] leading-4">
            {problemJson}
          </pre>
        </details>
      </div>

      {/* ------------------------------------------------------ sidebar */}
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-base border-2 border-border bg-secondary-background p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs">
            <span className="font-heading uppercase tracking-widest">{editing ? `Editing ${editing}` : "New problem"}</span>
            <span className="text-muted">
              {save === "saving" ? "Saving draft…" : save === "saved" ? "Draft saved" : save === "error" ? "Draft not saved" : draftId ? "Draft" : ""}
            </span>
          </div>
          <div className="mt-4 grid gap-2">
            <Button variant="neutral" onClick={fillOutputs} disabled={!!busy || !!sigError || !(s.examples.length + s.tests.length)}>
              {busy === "outputs" ? <Spinner /> : <Wand2 />} Fill outputs from reference
            </Button>
            <Button variant="neutral" onClick={() => submit(true)} disabled={!!busy || issues.length > 0}>
              {busy === "validate" ? <Spinner /> : <FlaskConical />} Check against all tests
            </Button>
            <Button
              onClick={() => submit(false)}
              disabled={!!busy || issues.length > 0 || !isVerified}
              title={isVerified ? undefined : "Check against all tests first"}
            >
              {busy === "publish" ? <Spinner /> : <Rocket />} {editing ? "Publish changes" : "Publish"}
            </Button>
            {!isVerified && issues.length === 0 && (
              <p className="text-xs text-muted">
                {verified ? "You changed something since the last check. " : ""}
                Run &ldquo;Check against all tests&rdquo; to verify every expected output before publishing.
              </p>
            )}
            {draftId && (
              <Button variant="neutral" size="sm" onClick={discardDraft} className="mt-1">
                <Trash2 /> Discard draft
              </Button>
            )}
          </div>
        </div>
        {issues.length > 0 && (
          <div className="rounded-base border-2 border-border bg-accent-yellow/40 p-4 text-sm shadow-shadow">
            <div className="mb-2 font-heading">Before publishing</div>
            <ul className="list-disc space-y-1 pl-5">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        )}
        {result && <ResultPanel result={result} />}
      </aside>
    </div>
  );
}

function Card({ icon, title, right, children }: { icon: React.ReactNode; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-base border-2 border-border bg-secondary-background p-5 shadow-lg">
      <h2 className="mb-4 flex flex-wrap items-center gap-2 text-xl [&>svg]:size-5">
        {icon} {title}
        <span className="ml-auto">{right}</span>
      </h2>
      {children}
    </section>
  );
}

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function CaseList({
  list,
  cases,
  signature,
  onChange,
  onAdd,
  onRemove,
  explanations,
  max,
}: {
  list: "examples" | "tests";
  cases: BuilderCase[];
  signature: Signature;
  onChange: (list: "examples" | "tests", i: number, patch: Partial<BuilderCase>) => void;
  onAdd: (list: "examples" | "tests", from?: BuilderCase) => void;
  onRemove: (list: "examples" | "tests", i: number) => void;
  explanations?: boolean;
  max: number;
}) {
  return (
    <div className="space-y-3">
      {cases.length === 0 && (
        <p className="rounded-base border-2 border-dashed border-border p-4 text-center text-sm text-muted">
          No hidden tests yet. Add edge cases and a few large inputs.
        </p>
      )}
      {cases.map((c, i) => (
        <div key={i} className="rounded-base border-2 border-border bg-background p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-heading">
              {list === "examples" ? "Example" : "Test"} {i + 1}
            </span>
            <div className="ml-auto flex gap-1">
              <Button size="icon" variant="neutral" className="size-7" disabled={cases.length >= max} onClick={() => onAdd(list, c)} title="Duplicate">
                <Copy className="size-3.5" />
              </Button>
              <Button size="icon" variant="neutral" className="size-7" onClick={() => onRemove(list, i)} title="Delete">
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {signature.params.map((p, j) => (
              <div key={j}>
                <label className="mb-1 block font-mono text-[11px] text-muted">
                  {p.name || `line ${j + 1}`} <span className="opacity-60">({p.type}{(parseType(p.type)?.depth ?? 0) >= 2 ? ", as JSON" : ""})</span>
                </label>
                <Input
                  value={c.values[j] ?? ""}
                  onChange={(e) => onChange(list, i, { values: c.values.map((v, k) => (k === j ? e.target.value : v)) })}
                  placeholder={placeholder(p.type)}
                  className="h-9 font-mono text-xs"
                  spellCheck={false}
                />
              </div>
            ))}
            <div>
              <label className="mb-1 block font-mono text-[11px] text-muted">
                expected output <span className="opacity-60">({signature.returns})</span>
              </label>
              {(parseType(signature.returns)?.depth ?? 0) >= 2 ? (
                <Textarea
                  value={c.output}
                  onChange={(e) => onChange(list, i, { output: e.target.value })}
                  placeholder="Filled by the reference"
                  className={cn("min-h-9 font-mono text-xs", !c.output.trim() && "border-dashed")}
                  rows={Math.min(6, Math.max(2, c.output.split("\n").length))}
                  spellCheck={false}
                />
              ) : (
                <Input
                  value={c.output}
                  onChange={(e) => onChange(list, i, { output: e.target.value })}
                  placeholder="Filled by the reference"
                  className={cn("h-9 font-mono text-xs", !c.output.trim() && "border-dashed")}
                  spellCheck={false}
                />
              )}
            </div>
            {explanations && (
              <div className="sm:col-span-2">
                <label className="mb-1 block font-mono text-[11px] text-muted">explanation (optional)</label>
                <Input value={c.explanation} onChange={(e) => onChange(list, i, { explanation: e.target.value })} className="h-9 text-xs" />
              </div>
            )}
          </div>
        </div>
      ))}
      <Button size="sm" variant="neutral" disabled={cases.length >= max} onClick={() => onAdd(list)}>
        <Plus /> Add {list === "examples" ? "example" : "test"}
      </Button>
    </div>
  );
}
