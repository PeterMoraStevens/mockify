import { ArrowLeft, Lock, LogIn } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Playground } from "@/components/problems/playground";
import { RevealList } from "@/components/problems/reveal-list";
import { Badge, DifficultyBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isLanguageId, type LanguageId } from "@/lib/languages";
import { getProblem } from "@/lib/problems/store";
import { formatOutput, readableInput, type Signature } from "@/lib/problems/starters";
import { getCurrentUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/problems/[slug]">) {
  const p = getProblem((await params).slug);
  return { title: p ? `${p.title} · Mockify` : "Not found · Mockify" };
}

/**
 * One problem: statement, examples, hints and follow-ups (revealed on click),
 * and, for signed-in users only, an editor to run and submit code outside a
 * room. Hidden tests and the reference solution never leave the server.
 */
export default async function ProblemPage({ params }: PageProps<"/problems/[slug]">) {
  const { slug } = await params;
  const problem = getProblem(slug);
  if (!problem) notFound();
  const user = await getCurrentUser();
  const sig = problem.signature as Signature | undefined;
  const languages = Object.keys(problem.starters).filter(isLanguageId) as LanguageId[];
  const { hints, followUps, expectedComplexity } = problem.interviewer;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <Link href="/problems" className="inline-flex items-center gap-1.5 text-sm font-heading underline-offset-4 hover:underline">
        <ArrowLeft className="size-4" /> All problems
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ------------------------------------------------ statement */}
        <article className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={problem.difficulty} />
            {problem.tags.map((t) => (
              <Badge key={t} tone="neutral">
                {t}
              </Badge>
            ))}
          </div>
          <h1 className="mt-3 text-4xl">{problem.title}</h1>
          <div className="prose-brutal mt-5 text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.description}</ReactMarkdown>
          </div>

          <h2 className="mt-8 text-xs font-heading uppercase tracking-widest">Examples</h2>
          <div className="mt-3 space-y-3">
            {problem.examples.map((ex, i) => (
              <div key={i} className="overflow-hidden rounded-base border-2 border-border bg-secondary-background">
                <div className="border-b-2 border-border bg-background px-3 py-1 text-xs font-heading">Example {i + 1}</div>
                <div className="grid grid-cols-2 divide-x-2 divide-border">
                  <IO label="Input" value={sig ? readableInput(sig, ex.input) : ex.input} />
                  <IO label="Output" value={sig ? formatOutput(sig.returns, ex.output) : ex.output} />
                </div>
                {ex.explanation && <div className="border-t-2 border-border px-3 py-2 text-xs text-muted">{ex.explanation}</div>}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            + {problem.tests.length} hidden test{problem.tests.length === 1 ? "" : "s"} on Submit &middot; {problem.license}
            {problem.source?.name ? ` · ${problem.source.name}` : ""}
          </p>

          <div className="mt-8 space-y-4">
            <RevealList title="Hints" items={hints} noun="hint" />
            <RevealList title="Follow-up questions" items={followUps} noun="follow-up" />
            {expectedComplexity && (
              <RevealList
                title="Expected complexity"
                items={[`Time: ${expectedComplexity.time}`, `Space: ${expectedComplexity.space}`]}
                noun="complexity"
                all
              />
            )}
          </div>
        </article>

        {/* ----------------------------------------------- playground */}
        <section className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          {user ? (
            <Playground slug={problem.slug} starters={problem.starters} languages={languages} signature={sig ?? null} />
          ) : (
            <div className="rounded-base border-4 border-border bg-secondary-background p-8 text-center shadow-xl">
              <div className="mx-auto grid size-14 place-items-center rounded-base border-2 border-border bg-accent-yellow text-black">
                <Lock className="size-6" />
              </div>
              <h2 className="mt-4 text-2xl">Sign in to practice</h2>
              <p className="mt-2 text-sm text-muted">Write code in any of {languages.length} languages and run it against the examples and hidden tests.</p>
              <Button asChild className="mt-5">
                <Link href={`/login?next=${encodeURIComponent(`/problems/${problem.slug}`)}`}>
                  <LogIn /> Log in
                </Link>
              </Button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function IO({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 p-2">
      <div className="mb-1 text-[10px] font-heading uppercase tracking-wider text-muted">{label}</div>
      <pre className="max-h-40 overflow-auto font-mono text-xs leading-5 whitespace-pre-wrap break-all">{value.replace(/\n$/, "")}</pre>
    </div>
  );
}
