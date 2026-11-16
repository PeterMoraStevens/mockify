"use client";

import { Check, Copy, UserMinus, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { refreshNotifications, useFriendLists } from "@/components/notifications";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { FriendLists, Person } from "@/lib/social-types";

export function FriendsClient({ username, initial }: { username: string; initial: FriendLists }) {
  const [lists, setLists] = useState(initial);
  // Live: the notification poller refreshes friend lists every few seconds.
  const live = useFriendLists();
  useEffect(() => {
    if (live) setLists(live);
  }, [live]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name.trim().replace(/^@/, "") }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(b.error ?? "Couldn't send the request");
        return;
      }
      setLists(b);
      refreshNotifications();
      setName("");
      toast.success(b.status === "accepted" ? "You're now friends" : "Request sent");
    } finally {
      setBusy(false);
    }
  };

  const act = async (p: Person, action: "accept" | "remove") => {
    const r = await fetch("/api/friends", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: p.id, action }),
    });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast.error(b.error ?? "Something went wrong");
      return;
    }
    setLists(b);
    refreshNotifications();
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl">Friends</h1>
      <p className="mt-2 text-muted">Friends can invite each other straight into a room.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]">
        <form onSubmit={add} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add by username" maxLength={33} />
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? <Spinner /> : <UserPlus />} Add
          </Button>
        </form>
        <Button
          variant="neutral"
          onClick={async () => {
            await navigator.clipboard.writeText(username);
            toast.success("Username copied");
          }}
          title="Share this so people can add you"
        >
          <Copy /> You&apos;re @{username}
        </Button>
      </div>

      {lists.incoming.length > 0 && (
        <List title="Requests for you">
          {lists.incoming.map((p) => (
            <Row key={p.id} p={p}>
              <Button size="sm" variant="neutral" onClick={() => act(p, "remove")} title="Decline">
                <X />
              </Button>
              <Button size="sm" onClick={() => act(p, "accept")}>
                <Check /> Accept
              </Button>
            </Row>
          ))}
        </List>
      )}

      <List title={`Friends (${lists.friends.length})`}>
        {lists.friends.length === 0 ? (
          <p className="rounded-base border-2 border-dashed border-border p-6 text-center text-sm text-muted">
            No friends yet. Add someone by their username.
          </p>
        ) : (
          lists.friends.map((p) => (
            <Row key={p.id} p={p}>
              <Button size="sm" variant="neutral" onClick={() => act(p, "remove")} title="Remove friend">
                <UserMinus />
              </Button>
            </Row>
          ))
        )}
      </List>

      {lists.outgoing.length > 0 && (
        <List title="Sent requests">
          {lists.outgoing.map((p) => (
            <Row key={p.id} p={p}>
              <Button size="sm" variant="neutral" onClick={() => act(p, "remove")}>
                Cancel
              </Button>
            </Row>
          ))}
        </List>
      )}
    </main>
  );
}

function List({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xs font-heading uppercase tracking-widest">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ p, children }: { p: Person; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-base border-2 border-border bg-secondary-background p-3 shadow-shadow">
      <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-border bg-main font-heading text-black">
        {p.displayName[0]?.toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-heading">{p.displayName}</div>
        <div className="truncate text-xs text-muted">@{p.username}</div>
      </div>
      {children}
    </div>
  );
}
