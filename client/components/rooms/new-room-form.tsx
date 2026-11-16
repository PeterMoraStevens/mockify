"use client";

import { ArrowRight, Check, Clock, Code2, PenTool, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ROOM_LENGTH_OPTIONS_MIN, ROOM_MAX_MS, type RoomMode } from "@/lib/rooms";
import type { Person } from "@/lib/social-types";
import { cn } from "@/lib/utils";

const MODES: { value: RoomMode; title: string; body: string; icon: React.ReactNode; tone: string }[] = [
  {
    value: "coding",
    title: "Coding interview",
    body: "Shared editor, problems with hidden tests, and a whiteboard on the side.",
    icon: <Code2 />,
    tone: "bg-main",
  },
  {
    value: "design",
    title: "System design",
    body: "Whiteboard only, for sketching architecture. You can switch to coding later.",
    icon: <PenTool />,
    tone: "bg-accent-blue",
  },
];

const fmt = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60} hour${m === 60 ? "" : "s"}`);

export function NewRoomForm({
  initialMode,
  friends,
  openCount,
  maxOpen,
}: {
  initialMode: RoomMode;
  friends: Person[];
  openCount: number;
  maxOpen: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<RoomMode>(initialMode);
  const [minutes, setMinutes] = useState(60);
  const [invite, setInvite] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const full = openCount >= maxOpen;

  const toggle = (id: string) =>
    setInvite((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size < 10) n.add(id);
      return n;
    });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, minutes, invite: [...invite] }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) return void toast.error(b.error ?? "Couldn't create the room");
      if (b.notInvited?.length) toast.warning(`${b.notInvited.length} invite${b.notInvited.length === 1 ? "" : "s"} couldn't be sent`);
      else if (invite.size) toast.success(`Invited ${invite.size} friend${invite.size === 1 ? "" : "s"}`);
      router.push(`/room/${b.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl">New room</h1>
      <p className="mt-2 text-muted">Choose how the room is set up. Nothing is created until you press Create.</p>

      {full && (
        <div className="mt-6 rounded-base border-2 border-border bg-accent-yellow p-4 text-sm text-black shadow-shadow">
          <span className="font-heading">You already have {maxOpen} open rooms.</span> Close one on{" "}
          <Link href="/rooms" className="underline underline-offset-4">
            your Rooms page
          </Link>{" "}
          first.
        </div>
      )}

      <form onSubmit={create} className="mt-8 space-y-8">
        <fieldset>
          <legend className="mb-3 font-heading">Interview type</legend>
          <div className="grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Interview type">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={mode === m.value}
                onClick={() => setMode(m.value)}
                className={cn(
                  "relative rounded-base border-2 border-border p-5 text-left transition-all",
                  mode === m.value
                    ? "translate-x-boxShadowX translate-y-boxShadowY bg-secondary-background outline-4 outline-offset-2 outline-border"
                    : "bg-secondary-background shadow-shadow hover:bg-background",
                )}
              >
                <span className={cn("grid size-10 place-items-center rounded-base border-2 border-border text-black [&_svg]:size-5", m.tone)}>
                  {m.icon}
                </span>
                <span className="mt-3 block font-heading text-lg">{m.title}</span>
                <span className="mt-1 block text-sm text-muted">{m.body}</span>
                {mode === m.value && (
                  <span className="absolute right-3 top-3 grid size-6 place-items-center rounded-full border-2 border-border bg-accent-green text-black">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 flex items-center gap-2 font-heading">
            <Clock className="size-4" /> Room length
          </legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Room length">
            {ROOM_LENGTH_OPTIONS_MIN.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={minutes === m}
                onClick={() => setMinutes(m)}
                className={cn(
                  "rounded-base border-2 border-border px-4 py-2 font-heading text-sm transition-all",
                  minutes === m ? "bg-main text-main-foreground" : "bg-secondary-background shadow-shadow hover:bg-background",
                )}
              >
                {fmt(m)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            The room closes after this. You can extend it from inside, up to {ROOM_MAX_MS / 3_600_000} hours in total.
          </p>
        </fieldset>

        <fieldset>
          <legend className="mb-3 flex items-center gap-2 font-heading">
            <Users className="size-4" /> Invite friends <span className="font-base text-sm text-muted">(optional)</span>
          </legend>
          {friends.length === 0 ? (
            <p className="rounded-base border-2 border-dashed border-border p-4 text-sm text-muted">
              No friends yet.{" "}
              <Link href="/friends" className="underline underline-offset-4">
                Add some
              </Link>
              , or send the room link once it&apos;s made.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {friends.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={invite.has(f.id)}
                  onClick={() => toggle(f.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-base border-2 border-border px-3 py-1.5 text-sm transition-all",
                    invite.has(f.id) ? "bg-accent-green text-black" : "bg-secondary-background shadow-shadow hover:bg-background",
                  )}
                >
                  {invite.has(f.id) && <Check className="size-3.5" strokeWidth={3} />}
                  {f.displayName} <span className="text-xs opacity-60">@{f.username}</span>
                </button>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-muted">They get a notification with a Join button. Rooms seat two.</p>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3 border-t-2 border-border pt-6">
          <Button type="submit" size="lg" className="h-12 px-6 font-heading" disabled={busy || full}>
            {busy ? <Spinner /> : null} Create room <ArrowRight />
          </Button>
          <Button asChild variant="neutral" size="lg" className="h-12">
            <Link href="/rooms">Cancel</Link>
          </Button>
        </div>
      </form>
    </main>
  );
}
