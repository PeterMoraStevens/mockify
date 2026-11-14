"use client";

import { ArrowLeftRight, Copy, LogOut, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type * as Y from "yjs";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ConnSnapshot } from "@/lib/room/connection";
import type { PresenceState, Role } from "@/lib/room/session-doc";
import { cn } from "@/lib/utils";
import { FeedbackDialog, type FeedbackTarget } from "./feedback-dialog";
import { Timer } from "./timer";

export function RoomHeader({
  roomId,
  doc,
  snap,
  role,
  remote,
  onSwap,
  onLeave,
  feedback,
}: {
  roomId: string;
  doc: Y.Doc;
  snap: ConnSnapshot;
  role: Role | null;
  remote: PresenceState | null;
  onSwap: () => void;
  onLeave: () => void;
  feedback: FeedbackTarget | null;
}) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`);
    toast.success("Room link copied");
  };

  return (
    <header className="z-40 flex h-16 shrink-0 items-center gap-2 border-b-4 border-border bg-secondary-background px-3 sm:gap-3">
      <Logo className="[&>span:last-child]:hidden xl:[&>span:last-child]:inline" />
      <Button variant="neutral" size="sm" onClick={copy} className="hidden md:inline-flex" title="Copy the room link">
        <Copy /> Invite link
      </Button>
      <ConnBadge snap={snap} remoteName={remote?.user.name ?? null} />

      <div className="mx-auto">
        <Timer doc={doc} slot={snap.slot} canControl={role === "interviewer"} clockOffsetMs={snap.clockOffsetMs} />
      </div>

      {role && (
        <Badge tone={role === "interviewer" ? "violet" : "blue"} shadow className="hidden py-1 sm:inline-flex">
          {role}
        </Badge>
      )}
      <Button variant="neutral" size="sm" onClick={onSwap} disabled={!role} title="Swap interviewer and candidate">
        <ArrowLeftRight /> <span className="hidden lg:inline">Swap roles</span>
      </Button>
      {role === "interviewer" && (
        <Button
          size="sm"
          onClick={() => setFeedbackOpen(true)}
          disabled={!feedback}
          title={feedback ? `Leave feedback for ${feedback.candidateName}` : "The candidate needs to be here"}
        >
          <MessageSquarePlus /> <span className="hidden lg:inline">Feedback</span>
        </Button>
      )}
      <ModeToggle />
      <Button variant="neutral" size="sm" onClick={onLeave} className="bg-accent-red text-black" title="Leave the room">
        <LogOut /> <span className="hidden lg:inline">Leave</span>
      </Button>

      {feedback && <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} target={feedback} />}
    </header>
  );
}

function ConnBadge({ snap, remoteName }: { snap: ConnSnapshot; remoteName: string | null }) {
  let tone: string;
  let label: string;
  let title: string | undefined;
  switch (snap.status) {
    case "connected":
      if (snap.path === "relayed") {
        tone = "bg-accent-yellow";
        label = "Relayed";
        title = "A direct path wasn't possible, so media goes through Cloudflare TURN.";
      } else {
        tone = "bg-accent-green";
        label = snap.path === "direct" ? "Direct" : "Connected";
        title = "Peer-to-peer. Media goes straight between your browsers.";
      }
      break;
    case "waiting":
      tone = "bg-secondary-background";
      label = "Waiting for partner";
      break;
    case "reconnecting":
      tone = "bg-accent-yellow";
      label = "Reconnecting…";
      break;
    case "connecting":
      tone = "bg-accent-yellow";
      label = "Connecting…";
      break;
    default:
      tone = "bg-secondary-background";
      label = "Starting…";
  }

  return (
    <div
      title={title ?? (remoteName ? `With ${remoteName}` : undefined)}
      className={cn(
        "flex h-9 items-center gap-2 rounded-base border-2 border-border px-2.5 text-xs font-heading uppercase tracking-wide shadow-shadow",
        tone,
        snap.status === "connected" && "text-black",
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full border border-border",
          snap.status === "connected" ? "animate-pulse-ring bg-black" : "animate-pulse bg-foreground/50",
        )}
      />
      {label}
      {snap.status === "connected" && snap.rttMs !== null && (
        <span className="border-l-2 border-border pl-2 font-mono normal-case tracking-normal">{snap.rttMs}ms</span>
      )}
    </div>
  );
}
