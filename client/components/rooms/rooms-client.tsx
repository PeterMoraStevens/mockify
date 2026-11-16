"use client";

import { ArrowRight, Clock, DoorOpen, FileText, History, Inbox, Plus, Power, X } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NewRoomLink } from "@/components/new-room-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNow } from "@/lib/room/hooks";
import type { RoomSummary } from "@/lib/rooms";
import type { Invite } from "@/lib/social-types";

function left(ms: number) {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m left` : `${m}m left`;
}

export function RoomsClient({
  me,
  rooms,
  invites: initialInvites,
  limitHit,
  maxOpen,
}: {
  me: string;
  rooms: RoomSummary[];
  invites: Invite[];
  limitHit: boolean;
  maxOpen: number;
}) {
  const router = useRouter();
  const now = useNow(30_000);
  const [invites, setInvites] = useState(initialInvites);
  const open = rooms.filter((r) => r.open && r.expiresAt > now);
  const past = rooms.filter((r) => !(r.open && r.expiresAt > now));
  const openMine = open.filter((r) => r.createdByMe).length;

  const dismiss = async (id: string) => {
    setInvites((l) => l.filter((i) => i.id !== id));
    await fetch(`/api/invites/${id}`, { method: "DELETE" }).catch(() => {});
    router.refresh();
  };

  const others = (r: RoomSummary) => r.participants.filter((p) => p.id !== me);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Your rooms</h1>
          <p className="mt-2 text-muted">
            Rejoin a room that&apos;s still open, or look back at past interviews. You can have {maxOpen} open rooms at a time.
          </p>
        </div>
        <Button asChild disabled={openMine >= maxOpen}>
          <NewRoomLink>
            <Plus /> New room
          </NewRoomLink>
        </Button>
      </div>

      {limitHit && (
        <div className="mt-6 rounded-base border-2 border-border bg-accent-yellow p-4 text-sm text-black shadow-shadow">
          <span className="font-heading">You already have {maxOpen} open rooms.</span> Close one below (or end it from inside the
          room) before starting another.
        </div>
      )}

      {invites.length > 0 && (
        <Section icon={<Inbox />} title="Invites">
          {invites.map((i) => (
            <Card key={i.id} tone="bg-accent-blue/25">
              <div className="min-w-0 flex-1">
                <div className="font-heading">{i.from.displayName} invited you to an interview</div>
                <div className="text-xs text-muted">
                  @{i.from.username} &middot; {left(i.expiresAt - now)}
                </div>
              </div>
              <Button size="sm" variant="neutral" onClick={() => dismiss(i.id)} title="Dismiss">
                <X />
              </Button>
              <Button size="sm" asChild>
                <Link href={`/room/${i.roomId}`}>
                  Join <ArrowRight />
                </Link>
              </Button>
            </Card>
          ))}
        </Section>
      )}

      <Section icon={<DoorOpen />} title="Open rooms">
        {open.length === 0 ? (
          <Empty>No open rooms. Start a new interview or find a partner.</Empty>
        ) : (
          open.map((r) => (
            <Card key={r.id}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-heading">
                  {others(r).length ? `With ${others(r).map((p) => p.displayName).join(", ")}` : "Waiting for someone to join"}
                  {r.mode === "design" && <Badge tone="blue">System design</Badge>}
                  {r.problemTitle && <Badge tone="neutral">{r.problemTitle}</Badge>}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  <Clock className="size-3" /> {left(r.expiresAt - now)} &middot; started{" "}
                  {new Date(r.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </div>
              </div>
              <CloseRoomButton id={r.id} onClosed={() => router.refresh()} />
              <Button size="sm" asChild>
                <Link href={`/room/${r.id}`}>
                  Rejoin <ArrowRight />
                </Link>
              </Button>
            </Card>
          ))
        )}
      </Section>

      <Section icon={<History />} title="Past interviews">
        {past.length === 0 ? (
          <Empty>Finished interviews show up here with their code, whiteboard, notes and feedback.</Empty>
        ) : (
          past.map((r) => (
            <Card key={r.id}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-heading">
                  {r.problemTitle ?? (r.mode === "design" ? "System design" : "Free-form session")}
                  <span className="font-base text-muted">
                    {others(r).length ? `with ${others(r).map((p) => p.displayName).join(", ")}` : "(solo)"}
                  </span>
                </div>
                <div className="text-xs text-muted">
                  {new Date(r.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </div>
              </div>
              <Button size="sm" variant="neutral" asChild>
                <Link href={`/interviews/${r.id}`}>
                  <FileText /> Summary
                </Link>
              </Button>
            </Card>
          ))
        )}
      </Section>
    </main>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 flex items-center gap-2 text-xl [&_svg]:size-5">
        {icon} {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Card({ children, tone = "bg-secondary-background" }: { children: React.ReactNode; tone?: string }) {
  return <div className={`flex items-center gap-3 rounded-base border-2 border-border p-4 shadow-shadow ${tone}`}>{children}</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-base border-2 border-dashed border-border p-6 text-center text-sm text-muted">{children}</div>;
}

/** Ends the room for everyone (the summary stays). Click twice: the first click asks. */
function CloseRoomButton({ id, onClosed }: { id: string; onClosed: () => void }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  const close = async () => {
    if (!armed) return setArmed(true);
    setBusy(true);
    const r = await fetch(`/api/rooms/${id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!r?.ok) return void toast.error("Couldn't close the room");
    toast.success("Room closed");
    onClosed();
  };
  return (
    <Button
      size="sm"
      variant="neutral"
      onClick={close}
      disabled={busy}
      className={armed ? "bg-accent-red text-black" : undefined}
      title="Close this room for everyone. Its code, notes and reviews stay under Past interviews."
    >
      <Power /> {armed ? "Close it?" : "Close"}
    </Button>
  );
}
