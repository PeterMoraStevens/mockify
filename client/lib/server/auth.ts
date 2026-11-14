import "server-only";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "./db";

export const SESSION_COOKIE = "mockify_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

export type User = { id: string; username: string; displayName: string; createdAt: number };

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  created_at: number;
};

const toUser = (r: UserRow): User => ({
  id: r.id,
  username: r.username,
  displayName: r.display_name,
  createdAt: r.created_at,
});

// ------------------------------------------------------------ passwords

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return crypto.timingSafeEqual(key, expected);
}

// A fixed hash so unknown usernames take as long as wrong passwords.
let dummyHash: Promise<string> | null = null;

// ---------------------------------------------------------------- users

export async function createUser(
  username: string,
  displayName: string,
  password: string,
): Promise<User | "taken"> {
  const exists = db().prepare("SELECT 1 FROM users WHERE username = ?").get(username);
  if (exists) return "taken";
  const row: UserRow = {
    id: crypto.randomUUID(),
    username,
    display_name: displayName,
    password_hash: await hashPassword(password),
    created_at: Date.now(),
  };
  try {
    db()
      .prepare(
        "INSERT INTO users (id, username, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(row.id, row.username, row.display_name, row.password_hash, row.created_at);
  } catch {
    return "taken";
  }
  return toUser(row);
}

export async function verifyLogin(username: string, password: string): Promise<User | null> {
  const row = db().prepare("SELECT * FROM users WHERE username = ?").get(username) as
    | UserRow
    | undefined;
  if (!row) {
    dummyHash ??= hashPassword("not-a-real-password");
    await verifyPassword(password, await dummyHash);
    return null;
  }
  return (await verifyPassword(password, row.password_hash)) ? toUser(row) : null;
}

export function getUserById(id: string): User | null {
  const row = db().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? toUser(row) : null;
}

// ------------------------------------------------------------- sessions

const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export function createSession(userId: string): { token: string; expiresAt: number } {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const d = db();
  d.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  d.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
    hashToken(token),
    userId,
    expiresAt,
  );
  return { token, expiresAt };
}

export function deleteSession(token: string) {
  db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

function userForToken(token: string | undefined): User | null {
  if (!token) return null;
  const row = db()
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(hashToken(token), Date.now()) as UserRow | undefined;
  return row ? toUser(row) : null;
}

/** For server components and route handlers. */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  return userForToken(jar.get(SESSION_COOKIE)?.value);
}

/**
 * Route-handler guard. Returns the user, or a 401 response to return as-is.
 * Usage: `const auth = await requireUser(); if (auth instanceof NextResponse) return auth;`
 */
export async function requireUser(): Promise<User | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return user;
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: number, secure: boolean) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: new Date(expiresAt),
  });
}

// ---------------------------------------------------------- rate limits

type Bucket = { count: number; resetAt: number };
const gl = globalThis as unknown as { __mockifyRate?: Map<string, Bucket> };
const buckets = (gl.__mockifyRate ??= new Map());

/** Fixed-window limiter, in memory. Fine for a single homelab process. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    }
    return true;
  }
  b.count++;
  return b.count <= limit;
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}

export function isSecureRequest(req: Request): boolean {
  // Cloudflare's own header survives Traefik, which rewrites X-Forwarded-Proto
  // to "http" when the tunnel talks to it over plain HTTP.
  const visitor = req.headers.get("cf-visitor");
  if (visitor?.includes('"https"')) return true;
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return new URL(req.url).protocol === "https:";
}
