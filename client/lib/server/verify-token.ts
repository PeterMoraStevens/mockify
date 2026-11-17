import "server-only";
import crypto from "node:crypto";

/**
 * Proof that a problem passed verification (its reference solution matched
 * every expected output on Piston). The validate step hands one out; publish
 * only accepts the exact same problem content, from the same user, with a
 * token that hasn't expired. Any edit after validating means validating again.
 *
 * The key is per process, so a server restart just means validating again.
 */
const TTL_MS = 60 * 60 * 1000;
const g = globalThis as typeof globalThis & { __mockifyVerifyKey?: Buffer };
const key = (g.__mockifyVerifyKey ??= crypto.randomBytes(32));

const digest = (content: unknown) => crypto.createHash("sha256").update(JSON.stringify(content)).digest("base64url");
const sign = (userId: string, exp: number, hash: string) =>
  crypto.createHmac("sha256", key).update(`${userId}\n${exp}\n${hash}`).digest("base64url");

export function issueVerifyToken(userId: string, content: unknown): string {
  const exp = Date.now() + TTL_MS;
  return `${exp}.${sign(userId, exp, digest(content))}`;
}

export function checkVerifyToken(userId: string, content: unknown, token: unknown): boolean {
  if (typeof token !== "string") return false;
  const [expStr, mac] = token.split(".");
  const exp = Number(expStr);
  if (!mac || !Number.isFinite(exp) || exp < Date.now()) return false;
  const want = Buffer.from(sign(userId, exp, digest(content)));
  const got = Buffer.from(mac);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
