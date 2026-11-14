"use client";

import { FilePen, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, DifficultyBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type Owned = { slug: string; title: string; difficulty: "easy" | "medium" | "hard"; tags: string[]; tests: number; createdAt: number; editable: boolean };
type Draft = { id: string; title: string; createdAt: number; updatedAt: number };

export function LibraryClient({ problems, drafts }: { problems: Owned[]; drafts: Draft[] }) {
  const router = useRouter();

  const del = async (url: string, what: string) => {
    const r = await fetch(url, { method: "DELETE" });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast.error(b.error ?? `Couldn't delete the ${what}`);
      return;
    }
    toast.success(`Deleted ${what}`);
    router.refresh();
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Your problems</h1>
          <p className="mt-2 text-muted">Problems you&apos;ve published, and drafts you can pick back up.</p>
        </div>
        <Button asChild>
          <Link href="/problems/new">
            <Plus /> New problem
          </Link>
        </Button>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-xl">
          <FilePen className="size-5" /> Drafts
        </h2>
        <div className="space-y-3">
          {drafts.length === 0 ? (
            <Empty>Drafts save automatically while you build a problem.</Empty>
          ) : (
            drafts.map((d) => (
              <Row key={d.id}>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-heading">{d.title}</div>
                  <div className="text-xs text-muted">Edited {new Date(d.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</div>
                </div>
                <ConfirmDelete onConfirm={() => del(`/api/drafts/${d.id}`, "draft")} />
                <Button size="sm" asChild>
                  <Link href={`/problems/new?draft=${d.id}`}>
                    <Pencil /> Continue
                  </Link>
                </Button>
              </Row>
            ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-xl">
          <FileText className="size-5" /> Published
        </h2>
        <div className="space-y-3">
          {problems.length === 0 ? (
            <Empty>Problems you publish show up here. Everyone can use them in rooms.</Empty>
          ) : (
            problems.map((p) => (
              <Row key={p.slug}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-heading">{p.title}</span>
                    <DifficultyBadge difficulty={p.difficulty} />
                    {p.tags.slice(0, 3).map((t) => (
                      <Badge key={t} tone="neutral">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs text-muted">
                    {p.slug} &middot; {p.tests} tests &middot; published {new Date(p.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </div>
                </div>
                <ConfirmDelete onConfirm={() => del(`/api/problems/${p.slug}`, "problem")} />
                {p.editable && (
                  <Button size="sm" variant="neutral" asChild>
                    <Link href={`/problems/new?edit=${p.slug}`}>
                      <Pencil /> Edit
                    </Link>
                  </Button>
                )}
              </Row>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function ConfirmDelete({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <Button
      size="sm"
      variant="neutral"
      className={armed ? "bg-accent-red text-black" : ""}
      disabled={busy}
      onClick={async () => {
        if (!armed) return setArmed(true);
        setBusy(true);
        await onConfirm();
        setBusy(false);
        setArmed(false);
      }}
      title="Delete"
    >
      {busy ? <Spinner /> : <Trash2 />} {armed ? "Sure?" : ""}
    </Button>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3 rounded-base border-2 border-border bg-secondary-background p-4 shadow-shadow">{children}</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-base border-2 border-dashed border-border p-6 text-center text-sm text-muted">{children}</div>;
}
