import { FileCode2, Library, Plus } from "lucide-react";
import Link from "next/link";
import { Badge, DifficultyBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LANGUAGES, isLanguageId } from "@/lib/languages";
import { listProblems } from "@/lib/problems/store";

export const dynamic = "force-dynamic";

export default function ProblemsPage() {
  const problems = listProblems();
  const counts = {
    easy: problems.filter((p) => p.difficulty === "easy").length,
    medium: problems.filter((p) => p.difficulty === "medium").length,
    hard: problems.filter((p) => p.difficulty === "hard").length,
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl">Problem set</h1>
          <p className="mt-3 max-w-xl text-muted">
            Plain stdin/stdout problems that work in every Piston language. Open one to read it, reveal hints, and practice on your own. In a room, the interviewer picks one. Hidden tests stay on the server.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="neutral">
            <Link href="/problems/library">
              <Library /> Your problems
            </Link>
          </Button>
          <Button asChild>
            <Link href="/problems/new">
              <Plus /> Create a problem
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Badge tone="neutral" shadow>
          {problems.length} total
        </Badge>
        <Badge tone="green" shadow>
          {counts.easy} easy
        </Badge>
        <Badge tone="yellow" shadow>
          {counts.medium} medium
        </Badge>
        <Badge tone="red" shadow>
          {counts.hard} hard
        </Badge>
      </div>

      <div className="mt-8 overflow-hidden rounded-base border-4 border-border bg-secondary-background shadow-xl">
        {problems.length === 0 && (
          <div className="p-12 text-center text-muted">No problems yet. Upload the first one.</div>
        )}
        <ul className="divide-y-2 divide-border">
          {problems.map((p, i) => (
            <li key={p.slug} className="relative flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-background">
              <span className="w-8 font-mono text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
              <FileCode2 className="size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/problems/${p.slug}`} className="font-heading after:absolute after:inset-0 hover:underline">
                    {p.title}
                  </Link>
                  {p.uploaded && <Badge tone="violet">community</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {p.tags.map((t) => (
                    <span key={t} className="rounded-sm border border-border/40 px-1.5 text-xs text-muted">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="hidden gap-1 sm:flex">
                {p.languages.filter(isLanguageId).slice(0, 6).map((l) => (
                  <span key={l} className="rounded-sm border-2 border-border bg-background px-1 font-mono text-[10px] font-bold">
                    {LANGUAGES[l].short}
                  </span>
                ))}
                {p.languages.length > 6 && (
                  <span className="rounded-sm border-2 border-border bg-main px-1 font-mono text-[10px] font-bold text-main-foreground">
                    +{p.languages.length - 6}
                  </span>
                )}
              </div>
              <span className="w-20 text-right font-mono text-xs text-muted">{p.testCount} tests</span>
              <DifficultyBadge difficulty={p.difficulty} />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
