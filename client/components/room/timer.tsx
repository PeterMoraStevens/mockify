"use client";

import { Pause, Play, RotateCcw, TimerIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type * as Y from "yjs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNow, useY } from "@/lib/room/hooks";
import { getTimer, readTimer, type Slot, type TimerState } from "@/lib/room/session-doc";
import { cn } from "@/lib/utils";

const PRESETS = [15, 30, 45, 60, 90];

function remainingMs(t: TimerState, now: number, mySlot: Slot | null, clockOffsetMs: number) {
  if (!t.running || t.endsAt === null) return t.remainingMs;
  // endsAt is on the author's clock. Convert the other person's timestamp to ours.
  const localEnd = t.author === mySlot ? t.endsAt : t.endsAt - clockOffsetMs;
  return localEnd - now;
}

function fmt(ms: number) {
  const total = Math.ceil(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const body = h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return ms < 0 ? `+${body}` : body;
}

export function Timer({
  doc,
  slot,
  canControl,
  clockOffsetMs,
}: {
  doc: Y.Doc;
  slot: Slot | null;
  canControl: boolean;
  clockOffsetMs: number;
}) {
  const t = useY(getTimer(doc), () => readTimer(doc));
  const now = useNow(250);
  const left = remainingMs(t, now, slot, clockOffsetMs);
  const over = left < 0;
  const warn = !over && t.running && left < 5 * 60 * 1000;

  const notified = useRef(false);
  useEffect(() => {
    if (over && t.running && !notified.current) {
      notified.current = true;
      toast.warning("Time's up!");
    }
    if (!over) notified.current = false;
  }, [over, t.running]);

  const map = getTimer(doc);
  const start = () => {
    if (!slot) return;
    doc.transact(() => {
      map.set("running", true);
      map.set("endsAt", Date.now() + t.remainingMs);
      map.set("author", slot);
    });
  };
  const pause = () => {
    doc.transact(() => {
      map.set("running", false);
      map.set("remainingMs", left);
      map.delete("endsAt");
    });
  };
  const reset = (minutes?: number) => {
    const durationMs = minutes ? minutes * 60_000 : t.durationMs;
    doc.transact(() => {
      map.set("durationMs", durationMs);
      map.set("remainingMs", durationMs);
      map.set("running", false);
      map.delete("endsAt");
    });
  };

  const progress = Math.max(0, Math.min(1, left / t.durationMs));

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "relative flex h-10 min-w-28 items-center justify-center gap-2 overflow-hidden rounded-base border-2 border-border px-3 font-mono text-lg font-bold tabular-nums shadow-shadow",
          over ? "animate-pulse bg-accent-red text-black" : warn ? "bg-accent-yellow text-black" : "bg-secondary-background",
        )}
        title={t.running ? "Shared timer, running" : "Shared timer, paused"}
      >
        <span
          className="absolute inset-y-0 left-0 bg-main/30 transition-[width] duration-300"
          style={{ width: `${(1 - progress) * 100}%` }}
          aria-hidden
        />
        <TimerIcon className="relative size-4" />
        <span className="relative">{fmt(left)}</span>
      </div>
      {canControl && (
        <>
          <button
            onClick={t.running ? pause : start}
            className="grid size-10 place-items-center rounded-base border-2 border-border bg-main text-main-foreground shadow-shadow transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
            aria-label={t.running ? "Pause timer" : "Start timer"}
          >
            {t.running ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="grid size-10 place-items-center rounded-base border-2 border-border bg-secondary-background shadow-shadow transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
              aria-label="Timer options"
            >
              <RotateCcw className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="z-100" align="center">
              <DropdownMenuItem onClick={() => reset()}>Reset to {Math.round(t.durationMs / 60000)} min</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Set length</DropdownMenuLabel>
              {PRESETS.map((m) => (
                <DropdownMenuItem key={m} onClick={() => reset(m)}>
                  {m} minutes
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}
