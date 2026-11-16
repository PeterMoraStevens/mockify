import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { displayNameSchema, passwordSchema, usernameSchema } from "@/lib/account-rules";
import { SESSION_COOKIE, changePassword, rateLimit, requireUser, updateProfile } from "@/lib/server/auth";

const body = z.union([
  z.object({ username: usernameSchema.optional(), displayName: displayNameSchema.optional() }).strict(),
  z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema }).strict(),
]);

/** Edit your own profile: username / display name, or password. */
export async function PATCH(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const data = parsed.data;

  if ("newPassword" in data) {
    if (!rateLimit(`password:${auth.id}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
    }
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const ok = await changePassword(auth.id, data.currentPassword, data.newPassword, token);
    if (!ok) return NextResponse.json({ error: "Your current password is wrong" }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  if (!rateLimit(`profile:${auth.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many changes. Try again later." }, { status: 429 });
  }
  const user = updateProfile(auth.id, data);
  if (user === "taken") return NextResponse.json({ error: "That username is taken" }, { status: 409 });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user });
}
