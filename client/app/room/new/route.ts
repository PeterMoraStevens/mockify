import { newRoomId } from "@/lib/room-id";

// No rooms table: a room is just an unguessable ID. Whoever opens it first takes slot "a".
// The Location is relative on purpose: behind Coolify/Traefik/cloudflared, req.url
// carries the container's bind address (e.g. 0.0.0.0:3000), not the public domain.
export function GET() {
  return new Response(null, {
    status: 303,
    headers: { Location: `/room/${newRoomId()}`, "Cache-Control": "no-store" },
  });
}

export const dynamic = "force-dynamic";
