"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Items hidden until asked for: one at a time (hints), or all at once (`all`). */
export function RevealList({ title, items, noun, all = false }: { title: string; items: string[]; noun: string; all?: boolean }) {
  const [shown, setShown] = useState(0);
  if (!items.length) return null;
  const left = items.length - shown;
  return (
    <section className="rounded-base border-2 border-border bg-secondary-background p-4 shadow-shadow">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-heading">{title}</h2>
        <span className="text-xs text-muted">
          {shown}/{items.length} shown
        </span>
        <div className="ml-auto flex gap-2">
          {shown > 0 && (
            <Button size="sm" variant="neutral" onClick={() => setShown(0)}>
              <EyeOff /> Hide
            </Button>
          )}
          {left > 0 && (
            <Button size="sm" variant="neutral" onClick={() => setShown(all ? items.length : shown + 1)}>
              <Eye /> {all ? `Show ${noun}` : shown === 0 ? `Show a ${noun}` : `Next ${noun}`}
            </Button>
          )}
        </div>
      </div>
      {shown > 0 && (
        <ol className="mt-3 space-y-2">
          {items.slice(0, shown).map((h, i) => (
            <li key={i} className="flex gap-3 rounded-base border-2 border-border bg-background p-3 text-sm">
              {!all && <span className="font-heading text-muted">{i + 1}.</span>}
              <span>{h}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
