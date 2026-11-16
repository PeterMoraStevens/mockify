import { getCurrentUser } from "@/lib/server/auth";
import { createRoom } from "@/lib/server/rooms";

// Locations are relative on purpose: behind Coolify/Traefik/cloudflared, req.url
// carries the container's bind address (e.g. 0.0.0.0:3000), not the public domain.
const redirect = (to: string) =>
  new Response(null, { status: 303, headers: { Location: to, "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const mode = new URL(req.url).searchParams.get("mode") === "design" ? "design" : "coding";
  const user = await getCurrentUser();
  if (!user) return redirect(`/login?next=${encodeURIComponent(`/room/new${mode === "design" ? "?mode=design" : ""}`)}`);
  const id = createRoom(user.id, { mode });
  if (id === "limit") return redirect("/rooms?limit=1");
  return redirect(`/room/${id}`);
}

export const dynamic = "force-dynamic";
