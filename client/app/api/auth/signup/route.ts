import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clientIp,
  createSession,
  createUser,
  isSecureRequest,
  rateLimit,
  setSessionCookie,
} from "@/lib/server/auth";

const body = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Letters, digits, _ . - only"),
  displayName: z.string().trim().min(1).max(60),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  inviteCode: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  if (process.env.ALLOW_SIGNUPS === "false") {
    return NextResponse.json({ error: "Sign-ups are closed on this server" }, { status: 403 });
  }
  if (!rateLimit(`signup:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many sign-ups from this address" }, { status: 429 });
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { username, displayName, password, inviteCode } = parsed.data;

  const required = process.env.SIGNUP_INVITE_CODE;
  if (required && inviteCode !== required) {
    return NextResponse.json({ error: "That invite code isn't right" }, { status: 403 });
  }

  const user = await createUser(username, displayName, password);
  if (user === "taken") {
    return NextResponse.json({ error: "That username is taken" }, { status: 409 });
  }

  const { token, expiresAt } = createSession(user.id);
  const res = NextResponse.json({ user });
  setSessionCookie(res, token, expiresAt, isSecureRequest(req));
  return res;
}
