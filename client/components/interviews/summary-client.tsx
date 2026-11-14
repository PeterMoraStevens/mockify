"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ReviewForm } from "@/components/reviews/review-form";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewRole } from "@/lib/rooms";
import { cn } from "@/lib/utils";

export const BoardView = dynamic(() => import("./board-view"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[60vh] place-items-center">
      <Spinner />
    </div>
  ),
});

/** Your notes on the summary page: still editable, and you can (un)share them. */
export function MyNotes({ roomId, initial, initialShared, partnerName }: { roomId: string; initial: string; initialShared: boolean; partnerName: string | null }) {
  const [text, setText] = useState(initial);
  const [shared, setShared] = useState(initialShared);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = window.setTimeout(async () => {
      setState("saving");
      const r = await fetch(`/api/rooms/${roomId}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, shared }),
      }).catch(() => null);
      setState(r?.ok ? "saved" : "error");
    }, 800);
    return () => window.clearTimeout(t);
  }, [roomId, text, shared]);

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" className="size-4 accent-black" checked={shared} onChange={(e) => setShared(e.target.checked)} />
        <span className="flex-1">
          <span className="font-heading">{shared ? "Shared" : "Private"}</span>
          <span className="text-muted"> &middot; {shared ? `${partnerName ?? "The other person"} can read these.` : "only you can see these."}</span>
        </span>
        <span className="text-xs text-muted">{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Not saved" : ""}</span>
      </label>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-48 font-mono text-xs leading-5" placeholder="No notes." maxLength={50_000} />
    </div>
  );
}

/** Leave a review after the fact. Roles can swap mid-interview, so you say which one you were. */
export function LateReview({ roomId, role, subjectName, problemSlug }: { roomId: string; role: ReviewRole; subjectName: string; problemSlug: string | null }) {
  const router = useRouter();
  const [as, setAs] = useState<ReviewRole>(role);
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-heading">I was mostly the</span>
        {(["interviewer", "candidate"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setAs(r)}
            className={cn(
              "rounded-base border-2 border-border px-3 py-1 font-heading capitalize",
              as === r ? (r === "interviewer" ? "bg-accent-violet text-black" : "bg-accent-blue text-black") : "bg-background",
            )}
          >
            {r}
          </button>
        ))}
      </div>
      <ReviewForm key={as} roomId={roomId} role={as} subjectName={subjectName} problemSlug={problemSlug} onSaved={() => router.refresh()} />
    </div>
  );
}
