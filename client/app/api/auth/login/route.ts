import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clientIp,
  createSession,
  isSecureRequest,
  rateLimit,
  setSessionCookie,
  verifyLogin,
} from "@/lib/server/auth";

const body = z.object({
  username: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a username and password" }, { status: 400 });
  }
  const { username, password } = parsed.data;

  const ip = clientIp(req);
  if (
    !rateLimit(`login:ip:${ip}`, 30, 15 * 60 * 1000) ||
    !rateLimit(`login:user:${username.toLowerCase()}`, 10, 15 * 60 * 1000)
  ) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  const user = await verifyLogin(username, password);
  if (!user) {
    return NextResponse.json({ error: "Wrong username or password" }, { status: 401 });
  }

  const { token, expiresAt } = createSession(user.id);
  const res = NextResponse.json({ user });
  setSessionCookie(res, token, expiresAt, isSecureRequest(req));
  return res;
}
