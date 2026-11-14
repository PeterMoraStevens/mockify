import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { REVIEW_WINDOW_MS } from "@/lib/rooms";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { participantRoom } from "@/lib/server/room-access";
import { participantIds } from "@/lib/server/rooms";

const score = z.number().int().min(1).max(5);
const body = z.object({
  role: z.enum(["interviewer", "candidate"]),
  scores: z.tuple([score, score, score]),
  notes: z.string().max(10_000).default(""),
  problemSlug: z.string().max(64).nullable().optional(),
});

/** Review the other person in this room. Both sides can review each other; resubmitting replaces yours. */
export async function POST(req: Request, ctx: RouteContext<"/api/rooms/[roomId]/review">) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const room = participantRoom((await ctx.params).roomId, auth.id);
  if (room instanceof NextResponse) return room;

  const end = room.ended_at ?? (room.expires_at < Date.now() ? room.expires_at : null);
  if (end !== null && Date.now() > end + REVIEW_WINDOW_MS) {
    return NextResponse.json({ error: "Reviews close a week after the interview" }, { status: 410 });
  }
  const subject = participantIds(room.id).find((id) => id !== auth.id);
  if (!subject) return NextResponse.json({ error: "Nobody else was in this room" }, { status: 400 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid review" }, { status: 400 });
  }
  const r = parsed.data;
  db()
    .prepare(
      `INSERT INTO reviews (id, room_id, author_id, subject_id, author_role, score_1, score_2, score_3, notes, problem_slug, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (room_id, author_id, subject_id) DO UPDATE SET
         author_role = excluded.author_role, score_1 = excluded.score_1, score_2 = excluded.score_2,
         score_3 = excluded.score_3, notes = excluded.notes, problem_slug = excluded.problem_slug,
         created_at = excluded.created_at`,
    )
    .run(
      crypto.randomUUID(),
      room.id,
      auth.id,
      subject,
      r.role,
      r.scores[0],
      r.scores[1],
      r.scores[2],
      r.notes,
      r.problemSlug ?? room.problem_slug ?? null,
      Date.now(),
    );
  return NextResponse.json({ ok: true });
}
