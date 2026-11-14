import "server-only";
import * as Y from "yjs";
import { isLanguageId } from "@/lib/languages";
import { newRoomId } from "@/lib/room-id";
import { MAX_OPEN_ROOMS, ROOM_DEFAULT_MS, ROOM_MAX_MS, type RoomSummary } from "@/lib/rooms";
import { db, tx } from "./db";

export type RoomRow = {
  id: string;
  created_by: string;
  created_at: number;
  expires_at: number;
  ended_at: number | null;
  extensions: number;
  problem_slug: string | null;
  language: string | null;
  code: string | null;
  whiteboard: string | null;
  ydoc: Uint8Array | null;
  updated_at: number | null;
};

/** Saved docs can't grow without bound (whiteboard freehand strokes get big). */
export const MAX_YDOC_BYTES = 4 * 1024 * 1024;
const MAX_PARTICIPANTS = 2;

export const isOpen = (r: Pick<RoomRow, "ended_at" | "expires_at">, now = Date.now()) =>
  r.ended_at === null && r.expires_at > now;

export function getRoom(id: string): RoomRow | null {
  return (db().prepare("SELECT * FROM rooms WHERE id = ?").get(id) as RoomRow | undefined) ?? null;
}

export function openRoomCount(userId: string): number {
  const r = db()
    .prepare("SELECT COUNT(*) AS n FROM rooms WHERE created_by = ? AND ended_at IS NULL AND expires_at > ?")
    .get(userId, Date.now()) as { n: number };
  return r.n;
}

/** Creates a room. Matchmaking passes both people so nobody else can take a seat. */
export function createRoom(userId: string, opts: { members?: string[]; skipLimit?: boolean } = {}): string | "limit" {
  return tx(() => {
    if (!opts.skipLimit && openRoomCount(userId) >= MAX_OPEN_ROOMS) return "limit";
    const id = newRoomId();
    const now = Date.now();
    db()
      .prepare("INSERT INTO rooms (id, created_by, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .run(id, userId, now, now + ROOM_DEFAULT_MS);
    const add = db().prepare("INSERT OR IGNORE INTO room_attendance (room_id, user_id, seen_at, joined_at) VALUES (?, ?, ?, ?)");
    for (const m of opts.members ?? []) add.run(id, m, now, now);
    return id;
  });
}

export function participantIds(roomId: string): string[] {
  return (
    db().prepare("SELECT user_id FROM room_attendance WHERE room_id = ? ORDER BY joined_at").all(roomId) as {
      user_id: string;
    }[]
  ).map((r) => r.user_id);
}

export const isParticipant = (roomId: string, userId: string) =>
  !!db().prepare("SELECT 1 FROM room_attendance WHERE room_id = ? AND user_id = ?").get(roomId, userId);

export type JoinResult = "ok" | "missing" | "ended" | "full";

/** Takes a seat (or refreshes it). A room seats two distinct people for its whole life. */
export function joinRoom(roomId: string, userId: string): JoinResult {
  return tx(() => {
    const room = getRoom(roomId);
    if (!room) return "missing";
    if (!isOpen(room)) return "ended";
    const ids = participantIds(roomId);
    const now = Date.now();
    if (ids.includes(userId)) {
      db().prepare("UPDATE room_attendance SET seen_at = ? WHERE room_id = ? AND user_id = ?").run(now, roomId, userId);
      return "ok";
    }
    if (ids.length >= MAX_PARTICIPANTS) return "full";
    db()
      .prepare("INSERT INTO room_attendance (room_id, user_id, seen_at, joined_at) VALUES (?, ?, ?, ?)")
      .run(roomId, userId, now, now);
    return "ok";
  });
}

/** Pushes the deadline back, capped at ROOM_MAX_MS after creation. */
export function extendRoom(roomId: string, minutes: number): RoomRow | "ended" | "max" {
  return tx(() => {
    const room = getRoom(roomId);
    if (!room || !isOpen(room)) return "ended";
    const cap = room.created_at + ROOM_MAX_MS;
    if (room.expires_at >= cap) return "max";
    const expires = Math.min(cap, room.expires_at + minutes * 60_000);
    db()
      .prepare("UPDATE rooms SET expires_at = ?, extensions = extensions + 1 WHERE id = ?")
      .run(expires, roomId);
    return { ...room, expires_at: expires, extensions: room.extensions + 1 };
  });
}

export function endRoom(roomId: string) {
  db().prepare("UPDATE rooms SET ended_at = ? WHERE id = ? AND ended_at IS NULL").run(Date.now(), roomId);
}

/**
 * Merges a browser's copy of the shared Y.Doc into the saved one. Both people
 * save, and Yjs updates merge without conflicts, so the order doesn't matter.
 * The readable columns (code, whiteboard, …) are derived from the merged doc.
 */
export function saveRoomDoc(roomId: string, update: Uint8Array): "ok" | "too-large" | "bad" {
  const room = getRoom(roomId);
  if (!room) return "bad";
  const doc = new Y.Doc();
  try {
    if (room.ydoc) Y.applyUpdate(doc, room.ydoc);
    Y.applyUpdate(doc, update);
  } catch {
    return "bad";
  }
  const merged = Y.encodeStateAsUpdate(doc);
  if (merged.byteLength > MAX_YDOC_BYTES) return "too-large";

  const session = doc.getMap<unknown>("session");
  const slug = session.get("problemSlug");
  const lang = session.get("language");
  const elements = [...doc.getMap<Record<string, unknown>>("wb").values()].filter((e) => !e.isDeleted);
  db()
    .prepare(
      `UPDATE rooms SET ydoc = ?, code = ?, language = ?, problem_slug = ?, whiteboard = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      merged,
      doc.getText("code").toString(),
      typeof lang === "string" && isLanguageId(lang) ? lang : null,
      typeof slug === "string" ? slug.slice(0, 64) : null,
      elements.length ? JSON.stringify(elements) : null,
      Date.now(),
      roomId,
    );
  doc.destroy();
  return "ok";
}

type UserBits = { id: string; display_name: string; username: string };

function membersOf(roomIds: string[]): Map<string, UserBits[]> {
  const out = new Map<string, UserBits[]>();
  if (!roomIds.length) return out;
  const rows = db()
    .prepare(
      `SELECT a.room_id, u.id, u.display_name, u.username FROM room_attendance a JOIN users u ON u.id = a.user_id
       WHERE a.room_id IN (${roomIds.map(() => "?").join(",")}) ORDER BY a.joined_at`,
    )
    .all(...roomIds) as (UserBits & { room_id: string })[];
  for (const r of rows) {
    const list = out.get(r.room_id) ?? [];
    list.push(r);
    out.set(r.room_id, list);
  }
  return out;
}

/** Rooms this person created or sat in, newest first. */
export function roomsForUser(
  userId: string,
  titleOf: (slug: string) => string | null,
  limit = 50,
): RoomSummary[] {
  const rows = db()
    .prepare(
      `SELECT r.id, r.created_by, r.created_at, r.expires_at, r.ended_at, r.problem_slug FROM rooms r
       WHERE r.created_by = ? OR EXISTS (SELECT 1 FROM room_attendance a WHERE a.room_id = r.id AND a.user_id = ?)
       ORDER BY r.created_at DESC LIMIT ?`,
    )
    .all(userId, userId, limit) as Pick<
    RoomRow,
    "id" | "created_by" | "created_at" | "expires_at" | "ended_at" | "problem_slug"
  >[];
  const members = membersOf(rows.map((r) => r.id));
  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    endedAt: r.ended_at ?? (r.expires_at <= now ? r.expires_at : null),
    open: isOpen(r, now),
    createdByMe: r.created_by === userId,
    problemSlug: r.problem_slug,
    problemTitle: r.problem_slug ? titleOf(r.problem_slug) : null,
    participants: (members.get(r.id) ?? []).map((m) => ({ id: m.id, displayName: m.display_name, username: m.username })),
  }));
}
