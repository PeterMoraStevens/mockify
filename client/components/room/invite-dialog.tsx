"use client";

import { Check, Copy, Send, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { Person } from "@/lib/social-types";

export function InviteDialog({ roomId, open, onClose }: { roomId: string; open: boolean; onClose: () => void }) {
  const [friends, setFriends] = useState<Person[] | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/friends", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { friends: [] }))
      .then((b) => !cancelled && setFriends(b.friends ?? []))
      .catch(() => !cancelled && setFriends([]));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const copy = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`);
    toast.success("Room link copied");
  };

  const invite = async (p: Person) => {
    setSending(p.id);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, userId: p.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "Couldn't send the invite");
        return;
      }
      setSent((s) => new Set(s).add(p.id));
      toast.success(`Invited ${p.displayName}`);
    } finally {
      setSending(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Invite someone" description="Rooms seat two. Send the link, or invite a friend directly." className="max-w-md">
      <Button variant="neutral" className="w-full" onClick={copy}>
        <Copy /> Copy room link
      </Button>

      <div className="mt-6 flex items-center justify-between">
        <h3 className="text-xs font-heading uppercase tracking-widest">Friends</h3>
        <Link href="/friends" target="_blank" className="flex items-center gap-1 text-xs font-heading underline underline-offset-4">
          <UserPlus className="size-3" /> Add friends
        </Link>
      </div>
      <div className="mt-2 max-h-72 space-y-2 overflow-y-auto scrollbar-thin">
        {friends === null ? (
          <div className="grid place-items-center py-6">
            <Spinner />
          </div>
        ) : friends.length === 0 ? (
          <p className="rounded-base border-2 border-dashed border-border p-4 text-center text-sm text-muted">
            No friends yet. Add people by username on the Friends page.
          </p>
        ) : (
          friends.map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded-base border-2 border-border bg-background p-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-border bg-main font-heading text-black">
                {f.displayName[0]?.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-heading">{f.displayName}</div>
                <div className="truncate text-xs text-muted">@{f.username}</div>
              </div>
              <Button size="sm" variant={sent.has(f.id) ? "neutral" : "default"} disabled={sending === f.id} onClick={() => invite(f)}>
                {sending === f.id ? <Spinner /> : sent.has(f.id) ? <Check /> : <Send />}
                {sent.has(f.id) ? "Sent" : "Invite"}
              </Button>
            </div>
          ))
        )}
      </div>
    </Dialog>
  );
}
