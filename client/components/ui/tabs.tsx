"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type TabItem<T extends string> = {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  hidden?: boolean;
  dot?: boolean;
};

/** Folder-style tabs: the active tab joins the panel below it. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  right,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-end gap-1 border-b-2 border-border px-2 pt-2", className)} role="tablist">
      {items
        .filter((i) => !i.hidden)
        .map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.value)}
              className={cn(
                "relative -mb-0.5 flex items-center gap-1.5 rounded-t-base border-2 border-b-0 px-3 py-1.5 text-sm font-heading transition-colors [&_svg]:size-4",
                active
                  ? "border-border bg-secondary-background"
                  : "border-transparent text-foreground/60 hover:text-foreground hover:bg-secondary-background/50",
              )}
            >
              {item.icon}
              {item.label}
              {item.dot && <span className="size-2 rounded-full border border-border bg-main" />}
              {active && <span className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-secondary-background" />}
            </button>
          );
        })}
      {right && <div className="ml-auto flex items-center gap-2 pb-1.5">{right}</div>}
    </div>
  );
}
