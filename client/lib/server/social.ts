import "server-only";
import crypto from "node:crypto";
import { db, tx } from "./db";
import { getRoom, isOpen, isParticipant } from "./rooms";

import type { FriendLists, Invite, Person } from "@/lib/social-types";

export type { FriendLists, Invite, Person };

const MAX_FRIENDS = 500;

type Row = { id: string; username: string; display_name: string };
const person = (r: Row): Person => ({ id: r.id, username: r.username, displayName: r.display_name });

export function friendLists(userId: string): FriendLists {
  const rows = db()
    .prepare(
      `SELECT f.requester_id, f.addressee_id, f.status, u.id, u.username, u.display_name
       FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
       WHERE f.requester_id = ? OR f.addressee_id = ?
       ORDER BY u.display_name COLLATE NOCASE`,
    )
    .all(userId, userId, userId) as (Row & { requester_id: string; status: string })[];
  const out: FriendLists = { friends: [], incoming: [], outgoing: [] };
  for (const r of rows) {
    if (r.status === "accepted") out.friends.push(person(r));
    else if (r.requester_id === userId) out.outgoing.push(person(r));
    else out.incoming.push(person(r));
  }
  return out;
}

export function areFriends(a: string, b: string): boolean {
  return !!db()
    .prepare(
      `SELECT 1 FROM friendships WHERE status = 'accepted' AND
       ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`,
    )
    .get(a, b, b, a);
}

export type RequestResult = "sent" | "accepted" | "already" | "self" | "not-found" | "limit";

/** Send a request by username. If they already asked you, this accepts it. */
export function requestFriend(userId: string, username: string): RequestResult {
  return tx(() => {
    const target = db().prepare("SELECT id FROM users WHERE username = ?").get(username) as { id: string } | undefined;
    if (!target) return "not-found";
    if (target.id === userId) return "self";
    const existing = db()
      .prepare(
        `SELECT requester_id, status FROM friendships
         WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
      )
      .get(userId, target.id, target.id, userId) as { requester_id: string; status: string } | undefined;
    if (existing?.status === "accepted") return "already";
    if (existing && existing.requester_id === target.id) {
      db()
        .prepare("UPDATE friendships SET status = 'accepted' WHERE requester_id = ? AND addressee_id = ?")
        .run(target.id, userId);
      return "accepted";
    }
    if (existing) return "already";
    const { n } = db()
      .prepare("SELECT COUNT(*) AS n FROM friendships WHERE requester_id = ? OR addressee_id = ?")
      .get(userId, userId) as { n: number };
    if (n >= MAX_FRIENDS) return "limit";
    db()
      .prepare("INSERT INTO friendships (requester_id, addressee_id, status, created_at) VALUES (?, ?, 'pending', ?)")
      .run(userId, target.id, Date.now());
    return "sent";
  });
}

export function acceptFriend(userId: string, requesterId: string): boolean {
  const r = db()
    .prepare(
      "UPDATE friendships SET status = 'accepted' WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'",
    )
    .run(requesterId, userId);
  return Number(r.changes) > 0;
}

/** Declines, cancels or unfriends: whichever applies. */
export function removeFriend(userId: string, otherId: string) {
  db()
    .prepare(
      "DELETE FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)",
    )
    .run(userId, otherId, otherId, userId);
}

export type InviteResult = "ok" | "not-friends" | "room-closed" | "not-in-room" | "already-in-room";

export function inviteToRoom(fromId: string, roomId: string, toId: string): InviteResult {
  const room = getRoom(roomId);
  if (!room || !isOpen(room)) return "room-closed";
  if (!isParticipant(roomId, fromId) && room.created_by !== fromId) return "not-in-room";
  if (!areFriends(fromId, toId)) return "not-friends";
  if (isParticipant(roomId, toId)) return "already-in-room";
  db()
    .prepare(
      `INSERT INTO room_invites (id, room_id, from_id, to_id, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (room_id, to_id) DO UPDATE SET from_id = excluded.from_id, created_at = excluded.created_at, dismissed = 0`,
    )
    .run(crypto.randomUUID(), roomId, fromId, toId, Date.now());
  return "ok";
}

/** Invites to rooms that are still open and that you haven't joined or dismissed. */
export function pendingInvites(userId: string): Invite[] {
  const rows = db()
    .prepare(
      `SELECT i.id, i.room_id, i.created_at, r.expires_at, u.id AS uid, u.username, u.display_name
       FROM room_invites i
       JOIN rooms r ON r.id = i.room_id
       JOIN users u ON u.id = i.from_id
       WHERE i.to_id = ? AND i.dismissed = 0 AND r.ended_at IS NULL AND r.expires_at > ?
         AND NOT EXISTS (SELECT 1 FROM room_attendance a WHERE a.room_id = i.room_id AND a.user_id = i.to_id)
       ORDER BY i.created_at DESC LIMIT 20`,
    )
    .all(userId, Date.now()) as {
    id: string;
    room_id: string;
    created_at: number;
    expires_at: number;
    uid: string;
    username: string;
    display_name: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    roomId: r.room_id,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    from: { id: r.uid, username: r.username, displayName: r.display_name },
  }));
}

export function dismissInvite(userId: string, inviteId: string) {
  db().prepare("UPDATE room_invites SET dismissed = 1 WHERE id = ? AND to_id = ?").run(inviteId, userId);
}
