"use client";

import { ArrowLeftRight, ChevronDown, Code2, Flag, Hourglass, LogOut, PenTool, UserPlus } from "lucide-react";
import type * as Y from "yjs";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ConnSnapshot } from "@/lib/room/connection";
import { useNow } from "@/lib/room/hooks";
import type { Role } from "@/lib/room/session-doc";
import { ROOM_EXTEND_OPTIONS_MIN, ROOM_MAX_MS, ROOM_WARN_MS, type RoomMode } from "@/lib/rooms";
import { cn } from "@/lib/utils";
import { Timer } from "./timer";

export function RoomHeader({
  doc,
  snap,
  role,
  deadline,
  onExtend,
  mode,
  onMode,
  onSwap,
  onInvite,
  onEnd,
  onLeave,
}: {
  doc: Y.Doc;
  snap: ConnSnapshot;
  role: Role | null;
  deadline: { expiresAt: number; maxExpiresAt: number };
  onExtend: (minutes: number) => void;
  mode: RoomMode;
  onMode: (m: RoomMode) => void;
  onSwap: () => void;
  onInvite: () => void;
  onEnd: () => void;
  onLeave: () => void;
}) {
  return (
    <header className="z-40 flex h-16 shrink-0 items-center gap-2 border-b-4 border-border bg-secondary-background px-3 sm:gap-3">
      <Logo className="[&>span:last-child]:hidden xl:[&>span:last-child]:inline" />
      <Button variant="neutral" size="sm" onClick={onInvite} className="hidden md:inline-flex" title="Invite someone to this room">
        <UserPlus /> Invite
      </Button>
      <ConnIndicator snap={snap} />
      <ModeSwitch mode={mode} onMode={onMode} disabled={!role} />

      <div className="mx-auto flex items-center gap-2">
        <Timer doc={doc} slot={snap.slot} canControl={role === "interviewer"} clockOffsetMs={snap.clockOffsetMs} />
      </div>

      <RoomClock deadline={deadline} onExtend={onExtend} />
      {role && (
        <Badge tone={role === "interviewer" ? "violet" : "blue"} shadow className="hidden py-1 sm:inline-flex">
          {role}
        </Badge>
      )}
      <Button variant="neutral" size="sm" onClick={onSwap} disabled={!role} title="Swap interviewer and candidate">
        <ArrowLeftRight /> <span className="hidden lg:inline">Swap roles</span>
      </Button>
      <Button size="sm" onClick={onEnd} disabled={!role} title="End the interview and leave feedback for each other">
        <Flag /> <span className="hidden lg:inline">End interview</span>
      </Button>
      <ModeToggle />
      <Button
        variant="neutral"
        size="sm"
        onClick={onLeave}
        className="bg-accent-red text-black"
        title="Leave for now. You can rejoin from Your rooms while the room is open."
      >
        <LogOut /> <span className="hidden xl:inline">Leave</span>
      </Button>
    </header>
  );
}

function fmtLeft(ms: number) {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  if (m >= 60) return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
  return `${m}m`;
}

/** How long the room itself stays open, with a way to extend it (up to the cap). */
function RoomClock({
  deadline,
  onExtend,
}: {
  deadline: { expiresAt: number; maxExpiresAt: number };
  onExtend: (minutes: number) => void;
}) {
  const now = useNow(5_000);
  const left = deadline.expiresAt - now;
  const atCap = deadline.expiresAt >= deadline.maxExpiresAt;
  const roomLeft = deadline.maxExpiresAt - deadline.expiresAt;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "hidden h-9 items-center gap-1.5 rounded-base border-2 border-border px-2.5 text-xs font-heading shadow-shadow transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none md:flex",
          left < 60_000 ? "animate-pulse bg-accent-red text-black" : left < ROOM_WARN_MS ? "bg-accent-yellow text-black" : "bg-secondary-background",
        )}
        title="Time left before this room closes"
      >
        <Hourglass className="size-3.5" />
        Room {fmtLeft(left)}
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="z-100 w-56" align="end">
        <DropdownMenuLabel>Room closes in {fmtLeft(left)}</DropdownMenuLabel>
        {ROOM_EXTEND_OPTIONS_MIN.map((m) => (
          <DropdownMenuItem key={m} disabled={atCap} onClick={() => onExtend(m)}>
            Extend by {m} minutes
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs text-muted">
          {atCap
            ? `Rooms last at most ${ROOM_MAX_MS / 3_600_000} hours. Start a new room to keep going.`
            : `Can be extended by up to ${fmtLeft(roomLeft)} more.`}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const QUALITY = [
  { max: 150, bars: 3, label: "Good" },
  { max: 350, bars: 2, label: "Fair" },
  { max: Infinity, bars: 1, label: "Poor" },
];

/**
 * Signal bars instead of jargon. The latency number only shows up when it's
 * bad enough to notice; the details live in the tooltip.
 */
function ConnIndicator({ snap }: { snap: ConnSnapshot }) {
  if (snap.status === "reconnecting" || snap.status === "connecting") {
    return (
      <div className="flex h-9 items-center gap-2 rounded-base border-2 border-border bg-accent-yellow px-2.5 text-xs font-heading text-black shadow-shadow">
        <span className="size-2 animate-pulse rounded-full border border-border bg-black/60" />
        {snap.status === "reconnecting" ? "Reconnecting…" : "Connecting…"}
      </div>
    );
  }
  if (snap.status !== "connected") return null;

  const q = snap.rttMs === null ? QUALITY[0] : QUALITY.find((x) => snap.rttMs! < x.max)!;
  const title = [
    `Connection: ${q.label.toLowerCase()}`,
    snap.rttMs !== null ? `${snap.rttMs} ms round trip` : null,
    snap.path === "relayed" ? "relayed through TURN" : snap.path === "direct" ? "direct" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div
      title={title}
      aria-label={title}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-base border-2 border-border px-2 shadow-shadow",
        q.bars === 1 ? "bg-accent-red text-black" : "bg-secondary-background",
      )}
    >
      <span className="flex h-4 items-end gap-0.5" aria-hidden>
        {[1, 2, 3].map((b) => (
          <span
            key={b}
            className={cn(
              "w-1 rounded-[1px] border border-border",
              b === 1 ? "h-1.5" : b === 2 ? "h-2.5" : "h-4",
              b <= q.bars ? (q.bars === 3 ? "bg-accent-green" : q.bars === 2 ? "bg-accent-yellow" : "bg-black") : "bg-transparent opacity-40",
            )}
          />
        ))}
      </span>
      {q.bars === 1 && snap.rttMs !== null && <span className="font-mono text-xs">{snap.rttMs}ms</span>}
    </div>
  );
}

/** Coding ⇄ system design. Either person can switch; it's shared. */
function ModeSwitch({ mode, onMode, disabled }: { mode: RoomMode; onMode: (m: RoomMode) => void; disabled: boolean }) {
  const items = [
    { value: "coding" as const, label: "Coding", icon: <Code2 className="size-4" /> },
    { value: "design" as const, label: "System design", icon: <PenTool className="size-4" /> },
  ];
  return (
    <div role="radiogroup" aria-label="Interview type" className="hidden overflow-hidden rounded-base border-2 border-border shadow-shadow md:flex">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="radio"
          aria-checked={mode === it.value}
          disabled={disabled}
          onClick={() => mode !== it.value && onMode(it.value)}
          title={it.value === "design" ? "Whiteboard-only layout for system design" : "Editor, tests and whiteboard"}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 text-xs font-heading transition-colors disabled:opacity-60 [&+&]:border-l-2 [&+&]:border-border",
            mode === it.value ? "bg-main text-main-foreground" : "bg-secondary-background hover:bg-background",
          )}
        >
          {it.icon}
          <span className="hidden xl:inline">{it.label}</span>
        </button>
      ))}
    </div>
  );
}
