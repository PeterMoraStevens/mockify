import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/server/db";
import {
  problemSchema,
  type InterviewerProblem,
  type Problem,
  type ProblemSummary,
  type PublicProblem,
} from "./schema";

/** Seed problems that ship with the repo. */
const BUILTIN_DIR = path.join(process.cwd(), "problems");
/** Problems uploaded through the UI (after their reference solution passed). */
export const UPLOAD_DIR = path.join(DATA_DIR, "problems");

type Entry = { problem: Problem; uploaded: boolean };
type Cache = { at: number; bySlug: Map<string, Entry> };
const g = globalThis as unknown as { __mockifyProblems?: Cache };
const TTL_MS = 5_000;

function readDir(dir: string, uploaded: boolean, into: Map<string, Entry>) {
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return;
  }
  for (const f of files) {
    try {
      const parsed = problemSchema.safeParse(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
      if (!parsed.success) {
        console.warn(`[problems] skipping ${f}: ${parsed.error.issues[0]?.message}`);
        continue;
      }
      // Built-ins win on slug collisions so uploads can't shadow them.
      if (!into.has(parsed.data.slug)) into.set(parsed.data.slug, { problem: parsed.data, uploaded });
    } catch (e) {
      console.warn(`[problems] skipping ${f}: ${(e as Error).message}`);
    }
  }
}

function load(): Map<string, Entry> {
  const c = g.__mockifyProblems;
  if (c && Date.now() - c.at < TTL_MS) return c.bySlug;
  const bySlug = new Map<string, Entry>();
  readDir(BUILTIN_DIR, false, bySlug);
  readDir(UPLOAD_DIR, true, bySlug);
  g.__mockifyProblems = { at: Date.now(), bySlug };
  return bySlug;
}

export function invalidateProblems() {
  g.__mockifyProblems = undefined;
}

const ORDER = { easy: 0, medium: 1, hard: 2 } as const;

export function listProblems(): ProblemSummary[] {
  return [...load().values()]
    .map(({ problem: p, uploaded }) => ({
      slug: p.slug,
      title: p.title,
      difficulty: p.difficulty,
      tags: p.tags,
      languages: Object.keys(p.starters),
      testCount: p.examples.length + p.tests.length,
      uploaded,
    }))
    .sort((a, b) => ORDER[a.difficulty] - ORDER[b.difficulty] || a.title.localeCompare(b.title));
}

export function getProblem(slug: string): Problem | null {
  return load().get(slug)?.problem ?? null;
}

export function toPublic(p: Problem): PublicProblem {
  return {
    slug: p.slug,
    title: p.title,
    difficulty: p.difficulty,
    tags: p.tags,
    license: p.license,
    source: p.source,
    description: p.description,
    examples: p.examples,
    ...(p.signature ? { signature: p.signature } : {}),
    starters: p.starters,
    hiddenCount: p.tests.length,
  };
}

export function toInterviewer(p: Problem): InterviewerProblem {
  return { ...toPublic(p), interviewer: p.interviewer };
}

export function saveUploadedProblem(p: Problem) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const file = path.join(UPLOAD_DIR, `${p.slug}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(p, null, 2) + "\n");
  fs.renameSync(tmp, file);
  invalidateProblems();
}

/** True if this slug is a problem uploaded through the UI (built-ins can't be replaced or deleted). */
export function isUploaded(slug: string): boolean {
  return load().get(slug)?.uploaded ?? false;
}

export function deleteUploadedProblem(slug: string) {
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, `${slug}.json`));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  invalidateProblems();
}
