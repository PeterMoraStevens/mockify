"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { Invite } from "@/lib/social-types";

/**
 * Polls for room invites while the tab is visible and pops a toast for new
 * ones. One poller per page (module-level store), shared by the badge.
 */

const POLL_MS = 20_000;
let invites: Invite[] = [];
const listeners = new Set<() => void>();
const seen = new Set<string>();
let started = false;
let primed = false;

function emit(next: Invite[]) {
  invites = next;
  for (const l of listeners) l();
}

async function poll(onNew: (i: Invite) => void) {
  if (document.visibilityState !== "visible") return;
  const r = await fetch("/api/invites", { cache: "no-store" }).catch(() => null);
  if (!r?.ok) return;
  const { invites: list } = (await r.json()) as { invites: Invite[] };
  for (const i of list) {
    if (!seen.has(i.id)) {
      seen.add(i.id);
      if (primed) onNew(i);
    }
  }
  primed = true;
  emit(list);
}

export function InviteWatcher() {
  const router = useRouter();
  useEffect(() => {
    if (started) return;
    started = true;
    const onNew = (i: Invite) =>
      toast(`${i.from.displayName} invited you to an interview`, {
        duration: 30_000,
        action: { label: "Join", onClick: () => router.push(`/room/${i.roomId}`) },
      });
    // New tab: toast invites from the last minute too, so a fresh page doesn't hide them.
    fetch("/api/invites", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { invites: [] }))
      .then(({ invites: list }: { invites: Invite[] }) => {
        for (const i of list) {
          seen.add(i.id);
          if (Date.now() - i.createdAt < 60_000 && !location.pathname.startsWith(`/room/${i.roomId}`)) onNew(i);
        }
        primed = true;
        emit(list);
      })
      .catch(() => {});
    const iv = window.setInterval(() => poll(onNew), POLL_MS);
    return () => {
      window.clearInterval(iv);
      started = false;
    };
  }, [router]);
  return null;
}

export function useInvites(): Invite[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => invites,
    () => invites,
  );
}

export function InviteBadge() {
  const n = useInvites().length;
  if (!n) return null;
  return (
    <span className="grid h-5 min-w-5 place-items-center rounded-full border-2 border-border bg-accent-red px-1 text-[10px] font-heading text-black">
      {n}
    </span>
  );
}
