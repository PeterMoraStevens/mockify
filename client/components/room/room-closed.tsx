import Link from "next/link";
import { NewRoomLink } from "@/components/new-room-link";
import { Button } from "@/components/ui/button";

const COPY = {
  missing: { badge: "?", title: "Room not found", body: "This link doesn't match any room. It may be mistyped, or from before rooms were saved." },
  ended: { badge: "⏹", title: "This interview has ended", body: "Rooms close when the interview is concluded or its time runs out." },
  full: { badge: "2/2", title: "This room is full", body: "Each room seats two people, and both seats are taken." },
} as const;

export function RoomClosed({ kind }: { kind: keyof typeof COPY }) {
  const c = COPY[kind];
  return (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center bg-grid p-4">
      <div className="max-w-md rounded-base border-4 border-border bg-secondary-background p-8 text-center shadow-xl">
        <div className="mx-auto grid size-16 place-items-center rounded-base border-2 border-border bg-accent-yellow text-2xl font-heading text-black">
          {c.badge}
        </div>
        <h1 className="mt-5 text-3xl">{c.title}</h1>
        <p className="mt-3 text-muted">{c.body}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="neutral">
            <Link href="/rooms">Your rooms</Link>
          </Button>
          <Button asChild>
            <NewRoomLink>New interview</NewRoomLink>
          </Button>
        </div>
      </div>
    </div>
  );
}
