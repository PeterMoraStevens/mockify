import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isRoomId } from "@/lib/room-id";
import { getUserById, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

const score = z.number().int().min(1).max(5);
const body = z.object({
  roomId: z.string().refine(isRoomId, "Bad room id"),
  candidateId: z.uuid(),
  problemSlug: z.string().max(64).nullable().optional(),
  problemSolving: score,
  communication: score,
  codeQuality: score,
  notes: z.string().max(10_000).default(""),
});

const ATTENDANCE_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid feedback" }, { status: 400 });
  }
  const f = parsed.data;

  if (f.candidateId === auth.id) {
    return NextResponse.json({ error: "You can't leave feedback for yourself" }, { status: 400 });
  }
  if (!getUserById(f.candidateId)) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  // Both people must have joined this room recently (recorded by /api/turn).
  const since = Date.now() - ATTENDANCE_WINDOW_MS;
  const present = db()
    .prepare(
      "SELECT COUNT(*) AS n FROM room_attendance WHERE room_id = ? AND user_id IN (?, ?) AND seen_at > ?",
    )
    .get(f.roomId, auth.id, f.candidateId, since) as { n: number };
  if (present.n < 2) {
    return NextResponse.json({ error: "You can only leave feedback for someone you interviewed" }, { status: 403 });
  }

  db()
    .prepare(
      `INSERT INTO feedback (id, room_id, interviewer_id, candidate_id, problem_slug,
         problem_solving, communication, code_quality, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (room_id, interviewer_id, candidate_id) DO UPDATE SET
         problem_slug = excluded.problem_slug,
         problem_solving = excluded.problem_solving,
         communication = excluded.communication,
         code_quality = excluded.code_quality,
         notes = excluded.notes,
         created_at = excluded.created_at`,
    )
    .run(
      crypto.randomUUID(),
      f.roomId,
      auth.id,
      f.candidateId,
      f.problemSlug ?? null,
      f.problemSolving,
      f.communication,
      f.codeQuality,
      f.notes,
      Date.now(),
    );

  return NextResponse.json({ ok: true });
}
