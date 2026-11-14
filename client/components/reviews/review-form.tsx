"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { REVIEW_CRITERIA, type ReviewRole } from "@/lib/rooms";
import { cn } from "@/lib/utils";

const SCALE = ["", "Needs work", "Below bar", "At bar", "Above bar", "Outstanding"];
const TONES = ["bg-main", "bg-accent-blue", "bg-accent-green"];

export type ReviewDraft = { scores: [number, number, number]; notes: string };

/**
 * Rate the other person. Interviewers rate the candidate's problem solving,
 * communication and code; candidates rate the interviewer's clarity,
 * helpfulness and professionalism.
 */
export function ReviewForm({
  roomId,
  role,
  subjectName,
  problemSlug,
  initial,
  submitLabel = "Save review",
  onSaved,
  secondary,
}: {
  roomId: string;
  role: ReviewRole;
  subjectName: string;
  problemSlug?: string | null;
  initial?: ReviewDraft;
  submitLabel?: string;
  onSaved: () => void;
  secondary?: React.ReactNode;
}) {
  const criteria = REVIEW_CRITERIA[role];
  const [scores, setScores] = useState<[number, number, number]>(initial?.scores ?? [3, 3, 3]);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, scores, notes, problemSlug: problemSlug ?? null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "Couldn't save your review");
        return;
      }
      toast.success(`Review saved for ${subjectName}`);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {criteria.map((c, ci) => (
        <div key={c.key}>
          <div className="flex items-baseline justify-between gap-2">
            <Label>{c.label}</Label>
            <span className="text-xs font-heading text-muted">{SCALE[scores[ci]]}</span>
          </div>
          <p className="mt-1 text-xs text-muted">{c.hint}</p>
          <div className="mt-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label={c.label}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={scores[ci] === n}
                onClick={() => setScores((s) => s.map((v, i) => (i === ci ? n : v)) as [number, number, number])}
                className={cn(
                  "h-10 rounded-base border-2 border-border font-heading transition-all",
                  scores[ci] === n
                    ? cn(TONES[ci], "translate-x-boxShadowX translate-y-boxShadowY text-black")
                    : n <= scores[ci]
                      ? cn(TONES[ci], "text-black opacity-60 shadow-shadow")
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
        <Label htmlFor={`review-notes-${roomId}`}>Written feedback</Label>
        <Textarea
          id={`review-notes-${roomId}`}
          className="mt-2 min-h-28"
          placeholder={
            role === "interviewer"
              ? "What went well? What should they practice next?"
              : "What made this a good (or not so good) interview?"
          }
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={10_000}
        />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {secondary}
        <Button onClick={submit} disabled={busy}>
          {busy ? <Spinner /> : <Send />} {submitLabel}
        </Button>
      </div>
    </div>
  );
}
