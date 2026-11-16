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

`;

/**
 * Schema changes after the first release. Each entry runs once, in order, inside
 * a transaction; PRAGMA user_version records how many have been applied.
 */
const MIGRATIONS: string[] = [
  // 1: persistent rooms, notes, two-way reviews, friends, invites, problem ownership, drafts.
  `
  CREATE TABLE rooms (
    id           TEXT PRIMARY KEY,
    created_by   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   INTEGER NOT NULL,
    expires_at   INTEGER NOT NULL,
    ended_at     INTEGER,
    extensions   INTEGER NOT NULL DEFAULT 0,
    problem_slug TEXT,
    language     TEXT,
    code         TEXT,
    whiteboard   TEXT,
    ydoc         BLOB,
    updated_at   INTEGER
  );
  CREATE INDEX rooms_creator ON rooms(created_by, created_at DESC);

  -- v0 feedback table (only interviewer → candidate), folded into reviews below.
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

  ALTER TABLE room_attendance ADD COLUMN joined_at INTEGER;
  UPDATE room_attendance SET joined_at = seen_at;
  CREATE INDEX room_attendance_user ON room_attendance(user_id, seen_at DESC);

  CREATE TABLE room_notes (
    room_id    TEXT NOT NULL,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT NOT NULL DEFAULT '',
    shared     INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (room_id, user_id)
  );

  CREATE TABLE reviews (
    id           TEXT PRIMARY KEY,
    room_id      TEXT NOT NULL,
    author_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_role  TEXT NOT NULL CHECK (author_role IN ('interviewer', 'candidate')),
    score_1      INTEGER NOT NULL,
    score_2      INTEGER NOT NULL,
    score_3      INTEGER NOT NULL,
    notes        TEXT NOT NULL DEFAULT '',
    problem_slug TEXT,
    created_at   INTEGER NOT NULL,
    UNIQUE (room_id, author_id, subject_id)
  );
  CREATE INDEX reviews_subject ON reviews(subject_id, created_at DESC);
  CREATE INDEX reviews_author ON reviews(author_id, created_at DESC);
  INSERT INTO reviews (id, room_id, author_id, subject_id, author_role, score_1, score_2, score_3, notes, problem_slug, created_at)
    SELECT id, room_id, interviewer_id, candidate_id, 'interviewer', problem_solving, communication, code_quality, notes, problem_slug, created_at
    FROM feedback;
  DROP TABLE feedback;

  CREATE TABLE friendships (
    requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
    created_at   INTEGER NOT NULL,
    PRIMARY KEY (requester_id, addressee_id)
  );
  CREATE INDEX friendships_addressee ON friendships(addressee_id);

  CREATE TABLE room_invites (
    id         TEXT PRIMARY KEY,
    room_id    TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    from_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    dismissed  INTEGER NOT NULL DEFAULT 0,
    UNIQUE (room_id, to_id)
  );
  CREATE INDEX room_invites_to ON room_invites(to_id, created_at DESC);

  CREATE TABLE problem_owners (
    slug       TEXT PRIMARY KEY,
    owner_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX problem_owners_owner ON problem_owners(owner_id);

  CREATE TABLE problem_drafts (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX problem_drafts_user ON problem_drafts(user_id, updated_at DESC);
  `,
  // 2: system design rooms (the starting mode; the room can switch later).
  `ALTER TABLE rooms ADD COLUMN mode TEXT NOT NULL DEFAULT 'coding';`,
];

function migrate(conn: DatabaseSync) {
  const { user_version: version } = conn.prepare("PRAGMA user_version").get() as { user_version: number };
  for (let i = version; i < MIGRATIONS.length; i++) {
    conn.exec("BEGIN");
    try {
      conn.exec(MIGRATIONS[i]);
      // PRAGMA can't take a bound parameter; i is a trusted integer.
      conn.exec(`PRAGMA user_version = ${i + 1}`);
      conn.exec("COMMIT");
    } catch (e) {
      conn.exec("ROLLBACK");
      throw new Error(`Database migration ${i + 1} failed: ${(e as Error).message}`);
    }
  }
}

const g = globalThis as unknown as { __mockifyDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.__mockifyDb) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const conn = new DatabaseSync(path.join(DATA_DIR, "mockify.sqlite"));
    conn.exec(SCHEMA);
    migrate(conn);
    g.__mockifyDb = conn;
  }
  return g.__mockifyDb;
}

/** Run `fn` in a transaction (node:sqlite has no helper for it). */
export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    d.exec("COMMIT");
    return out;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
