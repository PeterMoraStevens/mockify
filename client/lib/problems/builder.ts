// The problem builder's form state, and conversion to/from the problem JSON
// the server stores. Browser-safe (no server imports).

import { LANGUAGE_IDS, type LanguageId } from "@/lib/languages";
import type { Problem } from "./schema";
import {
  buildStdin,
  editableValue,
  encodeValue,
  generateStarter,
  generateStarters,
  ioSection,
  parseType,
  validateSignature,
  type Signature,
} from "./starters";

export type BuilderCase = { values: string[]; output: string; explanation: string };

export type BuilderState = {
  title: string;
  slug: string;
  slugEdited: boolean;
  difficulty: "easy" | "medium" | "hard";
  tags: string;
  license: string;
  sourceName: string;
  sourceUrl: string;
  statement: string;
  constraints: string;
  signature: Signature;
  /** One sentence shown above solve() in every starter. */
  doc: string;
  examples: BuilderCase[];
  tests: BuilderCase[];
  hints: string;
  followUps: string;
  time: string;
  space: string;
  notes: string;
  referenceLanguage: LanguageId;
  referenceCode: string;
  /** True until the author edits the reference, so it can follow signature changes. */
  referencePristine: boolean;
  languages: LanguageId[];
};

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

const blankCase = (n: number): BuilderCase => ({ values: Array(n).fill(""), output: "", explanation: "" });

export function emptyState(): BuilderState {
  const signature: Signature = { params: [{ name: "nums", type: "int[]" }], returns: "int" };
  const doc = "Return the answer.";
  return {
    title: "",
    slug: "",
    slugEdited: false,
    difficulty: "easy",
    tags: "",
    license: "MIT",
    sourceName: "",
    sourceUrl: "",
    statement: "",
    constraints: "",
    signature,
    doc,
    examples: [blankCase(1)],
    tests: [],
    hints: "",
    followUps: "",
    time: "",
    space: "",
    notes: "",
    referenceLanguage: "python",
    referenceCode: generateStarter("python", signature, doc),
    referencePristine: true,
    languages: [...LANGUAGE_IDS],
  };
}

const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/** The stdin for one case. Throws (with a readable message) if a value doesn't match its type. */
export const toInput = (c: BuilderCase, sig: Signature) =>
  buildStdin(sig.params.map((p, i) => encodeValue(p.type, c.values[i] ?? "", p.name)));

/** The first value error across the cases, e.g. "grid: write nested arrays as JSON". */
export function caseError(cases: BuilderCase[], sig: Signature, label: (i: number) => string): string | null {
  for (const [i, c] of cases.entries()) {
    try {
      toInput(c, sig);
    } catch (e) {
      return `${label(i)}, ${(e as Error).message}`;
    }
  }
  return null;
}
const withNewline = (s: string) => (s.endsWith("\n") ? s : `${s}\n`);

/** Problems in the client-side checks the author should fix before publishing. */
export function problemsWith(s: BuilderState): string[] {
  const out: string[] = [];
  if (s.title.trim().length < 3) out.push("Give it a title (3+ characters).");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.slug) || s.slug.length < 3) out.push("The URL name needs 3+ lowercase letters, digits or dashes.");
  if (s.statement.trim().length < 20) out.push("Write a problem statement (20+ characters).");
  const sigErr = validateSignature(s.signature);
  if (sigErr) out.push(sigErr);
  if (!s.examples.length) out.push("Add at least one example.");
  const all = [...s.examples, ...s.tests];
  if (all.some((c) => c.output.trim() === "" && c.values.every((v) => v === ""))) out.push("Remove empty test cases.");
  // An empty string is a legitimate answer for string-returning problems.
  if (!sigErr) {
    const err =
      caseError(s.examples, s.signature, (i) => `Example ${i + 1}`) ?? caseError(s.tests, s.signature, (i) => `Hidden test ${i + 1}`);
    if (err) out.push(err);
  }
  // An empty string or an empty array is a legitimate answer.
  const ret = parseType(s.signature.returns);
  if (ret && ret.depth === 0 && ret.base !== "string" && all.some((c) => c.output.trim() === "")) {
    out.push("Some tests have no expected output. Use “Fill outputs from reference”.");
  }
  if (!s.languages.length) out.push("Pick at least one language for starter code.");
  if (s.sourceUrl && !/^https?:\/\//.test(s.sourceUrl)) out.push("The source link must start with http:// or https://.");
  return out;
}

export function toProblem(s: BuilderState): Problem {
  const constraints = lines(s.constraints);
  const description = [s.statement.trim(), ioSection(s.signature), constraints.length ? `### Constraints\n${constraints.map((c) => `- ${c}`).join("\n")}` : ""]
    .filter(Boolean)
    .join("\n\n");
  const tc = (c: BuilderCase, withExplanation: boolean) => ({
    input: toInput(c, s.signature),
    output: withNewline(c.output),
    ...(withExplanation && c.explanation.trim() ? { explanation: c.explanation.trim() } : {}),
  });
  return {
    slug: s.slug,
    title: s.title.trim(),
    difficulty: s.difficulty,
    tags: s.tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 10),
    license: s.license.trim() || "MIT",
    ...(s.sourceName.trim() ? { source: { name: s.sourceName.trim(), ...(s.sourceUrl.trim() ? { url: s.sourceUrl.trim() } : {}) } } : {}),
    description,
    signature: s.signature,
    examples: s.examples.map((c) => tc(c, true)),
    tests: s.tests.map((c) => tc(c, false)),
    starters: generateStarters(s.signature, s.doc.trim() || "Return the answer.", s.languages),
    interviewer: {
      hints: lines(s.hints),
      followUps: lines(s.followUps),
      ...(s.time.trim() || s.space.trim() ? { expectedComplexity: { time: s.time.trim(), space: s.space.trim() } } : {}),
      ...(s.notes.trim() ? { notes: s.notes.trim() } : {}),
    },
    reference: { language: s.referenceLanguage, code: s.referenceCode },
  } as Problem;
}

/** Re-open a published problem in the builder. Only works for problems that carry a signature. */
export function fromProblem(p: Problem): BuilderState | null {
  if (!p.signature) return null;
  const sig = p.signature as Signature;
  const n = sig.params.length;
  // Split the generated description back into statement / IO / constraints.
  const [statement] = p.description.split(/\n### Input\n/);
  const cons = p.description.match(/### Constraints\n([\s\S]*)$/)?.[1] ?? "";
  const doc = p.starters.python?.match(/# (.+)\n/)?.[1] ?? "Return the answer.";
  const toCase = (t: { input: string; output: string; explanation?: string }): BuilderCase => {
    const parts = t.input.replace(/\n$/, "").split("\n");
    return {
      values: Array.from({ length: n }, (_, i) => editableValue(sig.params[i].type, parts[i] ?? "")),       output: t.output.replace(/\n$/, ""),
      explanation: t.explanation ?? "",
    };
  };
  return {
    title: p.title,
    slug: p.slug,
    slugEdited: true,
    difficulty: p.difficulty,
    tags: p.tags.join(", "),
    license: p.license,
    sourceName: p.source?.name ?? "",
    sourceUrl: p.source?.url ?? "",
    statement: statement.trim(),
    constraints: cons
      .split("\n")
      .map((l) => l.replace(/^- /, "").trim())
      .filter(Boolean)
      .join("\n"),
    signature: sig,
    doc,
    examples: p.examples.map(toCase),
    tests: p.tests.map(toCase),
    hints: p.interviewer.hints.join("\n"),
    followUps: p.interviewer.followUps.join("\n"),
    time: p.interviewer.expectedComplexity?.time ?? "",
    space: p.interviewer.expectedComplexity?.space ?? "",
    notes: p.interviewer.notes ?? "",
    referenceLanguage: p.reference.language,
    referenceCode: p.reference.code,
    referencePristine: false,
    languages: Object.keys(p.starters) as LanguageId[],
  };
}

/** Keep every case's values array in step with the parameter list. */
export function resizeCases(cases: BuilderCase[], n: number): BuilderCase[] {
  return cases.map((c) => ({ ...c, values: Array.from({ length: n }, (_, i) => c.values[i] ?? "") }));
}
