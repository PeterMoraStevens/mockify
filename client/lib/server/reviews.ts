import "server-only";
import type { ReviewRole } from "@/lib/rooms";
import { db } from "./db";

export type Review = {
  id: string;
  roomId: string;
  authorId: string;
  authorName: string;
  subjectId: string;
  subjectName: string;
  /** The author's role in the interview; decides what the three scores mean. */
  authorRole: ReviewRole;
  scores: [number, number, number];
  notes: string;
  problemSlug: string | null;
  createdAt: number;
};

type Row = {
  id: string;
  room_id: string;
  author_id: string;
  author_name: string;
  subject_id: string;
  subject_name: string;
  author_role: ReviewRole;
  score_1: number;
  score_2: number;
  score_3: number;
  notes: string;
  problem_slug: string | null;
  created_at: number;
};

const SELECT = `SELECT r.*, a.display_name AS author_name, s.display_name AS subject_name
  FROM reviews r JOIN users a ON a.id = r.author_id JOIN users s ON s.id = r.subject_id`;

const toReview = (r: Row): Review => ({
  id: r.id,
  roomId: r.room_id,
  authorId: r.author_id,
  authorName: r.author_name,
  subjectId: r.subject_id,
  subjectName: r.subject_name,
  authorRole: r.author_role,
  scores: [r.score_1, r.score_2, r.score_3],
  notes: r.notes,
  problemSlug: r.problem_slug,
  createdAt: r.created_at,
});

export function reviewsAbout(userId: string, limit = 100): Review[] {
  return (db().prepare(`${SELECT} WHERE r.subject_id = ? ORDER BY r.created_at DESC LIMIT ?`).all(userId, limit) as Row[]).map(toReview);
}

export function reviewsBy(userId: string, limit = 100): Review[] {
  return (db().prepare(`${SELECT} WHERE r.author_id = ? ORDER BY r.created_at DESC LIMIT ?`).all(userId, limit) as Row[]).map(toReview);
}

export function reviewsForRoom(roomId: string): Review[] {
  return (db().prepare(`${SELECT} WHERE r.room_id = ? ORDER BY r.created_at`).all(roomId) as Row[]).map(toReview);
}
