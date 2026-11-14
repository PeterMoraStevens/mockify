"use client";

import { ArrowRight, Flag, Share2 } from "lucide-react";
import { useState } from "react";
import { ReviewForm } from "@/components/reviews/review-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { EndedState, Role } from "@/lib/room/session-doc";

/** "Are you sure?" before ending the interview for both people. */
export function EndConfirmDialog({
  open,
  onClose,
  onConfirm,
  busy,
  partnerName,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
  partnerName: string | null;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="End the interview?"
      description={
        partnerName
          ? `This closes the room for you and ${partnerName}. You'll both be asked for feedback, and the code, whiteboard and notes are saved to the interview summary.`
          : "This closes the room. The code, whiteboard and your notes are saved to the interview summary."
      }
      className="max-w-md"
    >
      <div className="flex justify-end gap-3">
        <Button variant="neutral" onClick={onClose}>
          Keep going
        </Button>
        <Button onClick={onConfirm} disabled={busy} className="bg-accent-red text-black">
          {busy ? <Spinner /> : <Flag />} End interview
        </Button>
      </div>
    </Dialog>
  );
}

/** Shown to both people once the interview ends (by either of them, or the room's time running out). */
export function WrapUpDialog({
  roomId,
  ended,
  role,
  partnerName,
  problemSlug,
  shareNotes,
  onShareNotes,
  onFinish,
}: {
  roomId: string;
  ended: EndedState;
  role: Role | null;
  partnerName: string | null;
  problemSlug: string | null;
  shareNotes: boolean;
  onShareNotes: (v: boolean) => void;
  onFinish: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const finish = () => {
    setLeaving(true);
    onFinish();
  };
  const title = ended.reason === "expired" ? "Time's up" : "Interview over";
  const who = ended.reason === "expired" ? "The room's time ran out." : `${ended.byName} ended the interview.`;

  return (
    <Dialog
      open
      onClose={() => {}}
      title={title}
      description={
        partnerName && role
          ? `${who} Before you go, rate how it went for ${partnerName}. Only they see it, on their profile.`
          : `${who} Everything is saved to the interview summary.`
      }
      className="max-w-xl"
    >
      <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-base border-2 border-border bg-background p-3">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-black"
          checked={shareNotes}
          onChange={(e) => onShareNotes(e.target.checked)}
        />
        <span className="text-sm">
          <span className="flex items-center gap-1.5 font-heading">
            <Share2 className="size-4" /> Share my notes{partnerName ? ` with ${partnerName}` : ""}
          </span>
          <span className="text-muted">They&apos;ll see them on the interview summary. You can change this later.</span>
        </span>
      </label>

      {partnerName && role ? (
        <ReviewForm
          roomId={roomId}
          role={role}
          subjectName={partnerName}
          problemSlug={problemSlug}
          submitLabel="Save and finish"
          onSaved={finish}
          secondary={
            <Button variant="neutral" onClick={finish} disabled={leaving}>
              Skip for now
            </Button>
          }
        />
      ) : (
        <div className="flex justify-end">
          <Button onClick={finish} disabled={leaving}>
            {leaving ? <Spinner /> : <ArrowRight />} Go to summary
          </Button>
        </div>
      )}
    </Dialog>
  );
}
