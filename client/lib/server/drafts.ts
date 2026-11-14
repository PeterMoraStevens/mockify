import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "./db";

export const draftBody = z.object({ title: z.string().max(120), data: z.unknown() });

export const MAX_DRAFTS = 50;
export const MAX_DRAFT_BYTES = 1024 * 1024;

export type DraftSummary = { id: string; title: string; createdAt: number; updatedAt: number };

export function listDrafts(userId: string): DraftSummary[] {
  return (
    db()
      .prepare("SELECT id, title, created_at, updated_at FROM problem_drafts WHERE user_id = ? ORDER BY updated_at DESC")
      .all(userId) as { id: string; title: string; created_at: number; updated_at: number }[]
  ).map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export function getDraft(userId: string, id: string): (DraftSummary & { data: unknown }) | null {
  const r = db()
    .prepare("SELECT * FROM problem_drafts WHERE id = ? AND user_id = ?")
    .get(id, userId) as { id: string; title: string; data: string; created_at: number; updated_at: number } | undefined;
  if (!r) return null;
  return { id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at, data: JSON.parse(r.data) };
}

export function createDraft(userId: string, title: string, data: string): string | "limit" {
  const { n } = db().prepare("SELECT COUNT(*) AS n FROM problem_drafts WHERE user_id = ?").get(userId) as { n: number };
  if (n >= MAX_DRAFTS) return "limit";
  const id = crypto.randomUUID();
  const now = Date.now();
  db()
    .prepare("INSERT INTO problem_drafts (id, user_id, title, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, userId, title, data, now, now);
  return id;
}

export function updateDraft(userId: string, id: string, title: string, data: string): boolean {
  const r = db()
    .prepare("UPDATE problem_drafts SET title = ?, data = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .run(title, data, Date.now(), id, userId);
  return Number(r.changes) > 0;
}

export function deleteDraft(userId: string, id: string) {
  db().prepare("DELETE FROM problem_drafts WHERE id = ? AND user_id = ?").run(id, userId);
}
