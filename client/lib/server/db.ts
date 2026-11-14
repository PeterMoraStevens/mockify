import "server-only";
import fs from "node:fs";
import path from "node:path";
// node:sqlite ships with Node 22.13+ / 23.4+ (earlier versions need --experimental-sqlite).
import { DatabaseSync } from "node:sqlite";

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "data"));

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

-- Who requested TURN credentials for which room. Used to make sure feedback
-- is only left between two people who were actually in the same room.
CREATE TABLE IF NOT EXISTS room_attendance (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seen_at INTEGER NOT NULL,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS feedback (
  id              TEXT PRIMARY KEY,
  room_id         TEXT NOT NULL,
  interviewer_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_slug    TEXT,
  problem_solving INTEGER NOT NULL,
  communication   INTEGER NOT NULL,
  code_quality    INTEGER NOT NULL,
  notes           TEXT NOT NULL DEFAULT '',
  created_at      INTEGER NOT NULL,
  UNIQUE (room_id, interviewer_id, candidate_id)
);
CREATE INDEX IF NOT EXISTS feedback_candidate ON feedback(candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_interviewer ON feedback(interviewer_id, created_at DESC);
`;

const g = globalThis as unknown as { __mockifyDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.__mockifyDb) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const conn = new DatabaseSync(path.join(DATA_DIR, "mockify.sqlite"));
    conn.exec(SCHEMA);
    g.__mockifyDb = conn;
  }
  return g.__mockifyDb;
}
