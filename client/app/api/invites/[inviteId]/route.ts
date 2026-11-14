import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { dismissInvite } from "@/lib/server/social";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/invites/[inviteId]">) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  dismissInvite(auth.id, (await ctx.params).inviteId);
  return NextResponse.json({ ok: true });
}
