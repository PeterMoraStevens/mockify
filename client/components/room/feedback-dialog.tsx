"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type FeedbackTarget = {
  roomId: string;
  candidateId: string;
  candidateName: string;
  problemSlug: string | null;
};

const CATEGORIES = [
  { key: "problemSolving", label: "Problem solving", hint: "Breaking it down, picking an approach, handling edge cases", tone: "bg-main" },
  { key: "communication", label: "Communication", hint: "Thinking out loud, asking questions, explaining trade-offs", tone: "bg-accent-blue" },
  { key: "codeQuality", label: "Code quality", hint: "Readable, correct, idiomatic, tested", tone: "bg-accent-green" },
] as const;

const SCALE = ["", "Needs work", "Below bar", "At bar", "Above bar", "Outstanding"];

type Scores = Record<(typeof CATEGORIES)[number]["key"], number>;

export function FeedbackDialog({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: FeedbackTarget;
}) {
  const [scores, setScores] = useState<Scores>({ problemSolving: 3, communication: 3, codeQuality: 3 });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, candidateName: undefined, ...scores, notes }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "Couldn't save feedback");
        return;
      }
      toast.success(`Feedback saved to ${target.candidateName}'s profile`);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Feedback for ${target.candidateName}`}
      description="Saved to their profile. Submitting again from this room replaces your earlier feedback."
      className="max-w-xl"
    >
      <div className="space-y-5">
        {CATEGORIES.map((c) => (
          <div key={c.key}>
            <div className="flex items-baseline justify-between gap-2">
              <Label>{c.label}</Label>
              <span className="text-xs font-heading text-muted">{SCALE[scores[c.key]]}</span>
            </div>
            <p className="mt-1 text-xs text-muted">{c.hint}</p>
            <div className="mt-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label={c.label}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  role="radio"
                  aria-checked={scores[c.key] === n}
                  onClick={() => setScores((s) => ({ ...s, [c.key]: n }))}
                  className={cn(
                    "h-10 rounded-base border-2 border-border font-heading transition-all",
                    scores[c.key] === n
                      ? cn(c.tone, "translate-x-boxShadowX translate-y-boxShadowY text-black")
                      : n <= scores[c.key]
                        ? cn(c.tone, "text-black opacity-60 shadow-shadow")
                        : "bg-background shadow-shadow hover:bg-secondary-background",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div>
          <Label htmlFor="fb-notes">Written notes</Label>
          <Textarea
            id="fb-notes"
            className="mt-2 min-h-32"
            placeholder="What went well? What should they practice next?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={10_000}
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="neutral" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Spinner /> : <Send />} Save feedback
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
