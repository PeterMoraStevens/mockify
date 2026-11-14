"use client";

import { Radar, UserRoundSearch, Users, X, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "./avatar";
import { NewRoomLink } from "./new-room-link";
import { Button } from "./ui/button";

type Snapshot =
  | { status: "idle"; others: number }
  | { status: "waiting"; since: number; others: number }
  | { status: "matched"; roomId: string; partnerName: string };

export function MatchQueue({ name }: { name: string }) {
  const router = useRouter();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const waitingRef = useRef(false);

  const apply = useCallback(
    (s: Snapshot) => {
      setSnap(s);
      waitingRef.current = s.status === "waiting";
      if (s.status === "matched") {
        toast.success(`Matched with ${s.partnerName}!`);
        router.push(`/room/${s.roomId}`);
      }
    },
    [router],
  );

  const poll = useCallback(async () => {
    const res = await fetch("/api/match", { cache: "no-store" });
    if (res.ok) apply(await res.json());
  }, [apply]);

  useEffect(() => {
    const first = window.setTimeout(poll, 0);
    const iv = window.setInterval(() => {
      setNow(Date.now());
      poll();
    }, 2000);
    const leave = () => {
      if (waitingRef.current) navigator.sendBeacon?.("/api/match?leave=1");
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(iv);
      window.removeEventListener("pagehide", leave);
      if (waitingRef.current) fetch("/api/match", { method: "DELETE", keepalive: true });
    };
  }, [poll]);

  const join = async () => {
    setBusy(true);
    const res = await fetch("/api/match", { method: "POST" });
    setBusy(false);
    if (res.ok) apply(await res.json());
    else toast.error("Couldn't join the queue");
  };

  const leave = async () => {
    setBusy(true);
    await fetch("/api/match", { method: "DELETE" });
    setBusy(false);
    poll();
  };

  const waiting = snap?.status === "waiting";
  const others = snap && "others" in snap ? snap.others : 0;
  const waitedSec = snap?.status === "waiting" ? Math.max(0, Math.floor((now - snap.since) / 1000)) : 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-base border-4 border-border bg-secondary-background shadow-xl">
        <div className="flex items-center justify-between border-b-4 border-border bg-accent-blue px-6 py-4 text-black">
          <h1 className="flex items-center gap-3 text-2xl">
            <Users /> Available now
          </h1>
          <span className="flex items-center gap-2 rounded-base border-2 border-border bg-secondary-background px-2 py-0.5 text-sm font-heading text-foreground">
            <span className="size-2 animate-pulse-ring rounded-full bg-accent-green" />
            {others} other{others === 1 ? "" : "s"} waiting
          </span>
        </div>

        <div className="p-8 text-center">
          <div className="relative mx-auto grid size-40 place-items-center">
            {waiting && (
              <>
                <span className="absolute inset-0 animate-ping rounded-full border-4 border-border opacity-20" />
                <span className="absolute inset-4 animate-ping rounded-full border-4 border-main opacity-30 [animation-delay:400ms]" />
              </>
            )}
            <div className="relative grid size-28 place-items-center rounded-full border-4 border-border bg-main shadow-lg">
              {waiting ? <Radar className="size-12 animate-spin [animation-duration:3s]" /> : <UserRoundSearch className="size-12" />}
            </div>
          </div>

          <h2 className="mt-6 text-3xl">{waiting ? "Looking for a partner…" : "Practice with someone new"}</h2>
          <p className="mx-auto mt-3 max-w-md text-muted">
            {waiting
              ? `You've been waiting ${Math.floor(waitedSec / 60)}:${String(waitedSec % 60).padStart(2, "0")}. Keep this tab open and you'll go straight into a room when someone joins.`
              : "Join the queue and you'll be paired with the next person who's free. Once you're in the room, decide who interviews first and swap roles halfway through."}
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Avatar name={name} className="size-12" />
            <span className="h-1 w-12 border-t-4 border-dashed border-border" />
            <span className="grid size-12 place-items-center rounded-base border-2 border-dashed border-border font-heading text-xl">
              ?
            </span>
          </div>

          <div className="mt-8">
            {waiting ? (
              <Button variant="neutral" size="lg" onClick={leave} disabled={busy} className="font-heading">
                <X /> Leave queue
              </Button>
            ) : (
              <Button size="lg" onClick={join} disabled={busy || !snap} className="h-14 px-8 text-base font-heading">
                <Zap /> I&apos;m available
              </Button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Want to interview a friend instead? Just{" "}
        <NewRoomLink className="font-heading underline underline-offset-4">
          open a room
        </NewRoomLink>{" "}
        and send them the link.
      </p>
    </div>
  );
}
