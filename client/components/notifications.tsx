"use client";

import { Bell, Check, DoorOpen, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { FriendLists, Invite, Person } from "@/lib/social-types";
import { cn } from "@/lib/utils";

/**
 * Room invites and friend requests, polled while the tab is visible (and
 * right away when it comes back into focus). One poller per page, shared by
 * the bell, the Rooms badge and the friends page through a small store.
 */

const POLL_MS = 8_000;
type State = { invites: Invite[]; friends: FriendLists | null };
let state: State = { invites: [], friends: null };
const listeners = new Set<() => void>();
const seen = new Set<string>();
let primed = false;
let inflight: Promise<void> | null = null;
let onNewInvite: (i: Invite) => void = () => {};
let onNewRequest: (p: Person) => void = () => {};

function emit(next: State) {
  state = next;
  for (const l of listeners) l();
}

async function poll(force = false): Promise<void> {
  if (!force && document.visibilityState !== "visible") return;
  if (inflight) return inflight;
  inflight = (async () => {
    const r = await fetch("/api/notifications", { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return;
    const next = (await r.json()) as State;
    for (const i of next.invites) {
      const key = `i:${i.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // A fresh tab also shows invites from the last minute, so opening a page doesn't hide them.
      // (Not on /rooms, which lists them anyway, or inside the room it's for.)
      const inRoom = location.pathname.startsWith(`/room/${i.roomId}`);
      if (primed ? !inRoom : Date.now() - i.createdAt < 60_000 && !inRoom && location.pathname !== "/rooms") onNewInvite(i);
    }
    for (const p of next.friends?.incoming ?? []) {
      const key = `f:${p.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (primed && !location.pathname.startsWith("/friends")) onNewRequest(p);
    }
    primed = true;
    emit(next);
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Re-check now (after accepting a request, dismissing an invite…). */
export const refreshNotifications = () => poll(true);

let watchers = 0;
export function NotificationWatcher() {
  const router = useRouter();
  useEffect(() => {
    onNewInvite = (i) =>
      toast(`${i.from.displayName} invited you to an interview`, {
        id: `invite-${i.id}`,
        duration: 30_000,
        action: { label: "Join", onClick: () => router.push(`/room/${i.roomId}`) },
      });
    onNewRequest = (p) =>
      toast(`${p.displayName} sent you a friend request`, {
        id: `friend-${p.id}`,
        duration: 15_000,
        action: { label: "View", onClick: () => router.push("/friends") },
      });
    if (watchers++ > 0) return () => void watchers--;
    poll(true);
    const iv = window.setInterval(() => poll(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      watchers--;
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router]);
  return null;
}

function useNotifications(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

export const useInvites = () => useNotifications().invites;
/** Live friend lists (null until the first poll lands). */
export const useFriendLists = () => useNotifications().friends;

export function InviteBadge() {
  const n = useInvites().length;
  if (!n) return null;
  return <CountDot n={n} />;
}

function CountDot({ n, className }: { n: number; className?: string }) {
  return (
    <span
      className={cn(
        "grid h-5 min-w-5 place-items-center rounded-full border-2 border-border bg-accent-red px-1 text-[10px] font-heading text-black",
        className,
      )}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

/** Navbar bell: room invites and incoming friend requests. */
export function NotificationBell() {
  const { invites, friends } = useNotifications();
  const requests = friends?.incoming ?? [];
  const count = invites.length + requests.length;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();

  // Close on navigation, outside click and Escape.
  const [prevPath, setPrevPath] = useState(path);
  if (path !== prevPath) {
    setPrevPath(path);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const dismiss = async (i: Invite) => {
    emit({ ...state, invites: state.invites.filter((x) => x.id !== i.id) });
    await fetch(`/api/invites/${i.id}`, { method: "DELETE" }).catch(() => {});
    refreshNotifications();
  };
  const respond = async (p: Person, action: "accept" | "remove") => {
    const r = await fetch("/api/friends", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: p.id, action }),
    });
    if (!r.ok) toast.error("Something went wrong");
    else if (action === "accept") toast.success(`You and ${p.displayName} are now friends`);
    refreshNotifications();
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="neutral"
        size="icon"
        className="relative"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) refreshNotifications();
        }}
        aria-label={count ? `Notifications (${count})` : "Notifications"}
        aria-expanded={open}
      >
        <Bell />
        {count > 0 && <CountDot n={count} className="absolute -right-2 -top-2" />}
      </Button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-base border-2 border-border bg-secondary-background shadow-lg"
        >
          <div className="border-b-2 border-border px-4 py-2.5 font-heading">Notifications</div>
          {count === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Nothing new. Invites and friend requests show up here.</p>
          ) : (
            <ul className="max-h-96 divide-y-2 divide-border overflow-auto">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-base border-2 border-border bg-main text-black">
                    <DoorOpen className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <b>{i.from.displayName}</b> invited you to an interview
                    <div className="text-xs text-muted">{ago(i.createdAt)}</div>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/room/${i.roomId}`}>Join</Link>
                  </Button>
                  <Button size="icon" variant="neutral" className="size-8" onClick={() => dismiss(i)} aria-label="Dismiss invite">
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
              {requests.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-base border-2 border-border bg-accent-blue text-black">
                    <UserPlus className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <b>{p.displayName}</b> wants to be friends
                    <div className="truncate text-xs text-muted">@{p.username}</div>
                  </div>
                  <Button size="icon" className="size-8" onClick={() => respond(p, "accept")} aria-label={`Accept ${p.displayName}`}>
                    <Check className="size-4" />
                  </Button>
                  <Button size="icon" variant="neutral" className="size-8" onClick={() => respond(p, "remove")} aria-label={`Decline ${p.displayName}`}>
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-between border-t-2 border-border px-4 py-2 text-xs font-heading">
            <Link href="/rooms" className="underline underline-offset-4">
              Your rooms
            </Link>
            <Link href="/friends" className="underline underline-offset-4">
              Friends
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return `${h} hour${h === 1 ? "" : "s"} ago`;
}
