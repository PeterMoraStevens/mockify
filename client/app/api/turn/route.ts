import { NextResponse } from "next/server";
import { rateLimit, requireUser } from "@/lib/server/auth";
import { joinRoom } from "@/lib/server/rooms";
import { isRoomId } from "@/lib/room-id";

/**
 * Hands the browser everything it needs to join a room:
 *  - ICE servers: short-lived (4h) Cloudflare TURN credentials, minted here so
 *    the Cloudflare API token never leaves the server.
 *  - Where the PeerJS signaling server lives.
 * Also takes this user's seat in the room (two seats per room).
 */

const TTL_SECONDS = 4 * 60 * 60;
const STUN_ONLY: RTCIceServer[] = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];

type CloudflareIce = { urls: string | string[]; username?: string; credential?: string };

async function cloudflareIceServers(): Promise<{ servers: RTCIceServer[]; turn: boolean; error?: string }> {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (!keyId || !token) return { servers: STUN_ONLY, turn: false, error: "TURN not configured" };

  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: TTL_SECONDS }),
        cache: "no-store",
      },
    );
    if (!res.ok) throw new Error(`Cloudflare responded ${res.status}`);
    const body = (await res.json()) as { iceServers: CloudflareIce | CloudflareIce[] };
    const list = Array.isArray(body.iceServers) ? body.iceServers : [body.iceServers];
    const servers = list
      .map((s) => ({
        ...s,
        // Browsers block port 53; Cloudflare's docs recommend dropping those URLs.
        urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u)),
      }))
      .filter((s) => s.urls.length > 0);
    return { servers, turn: true };
  } catch (e) {
    console.error("[turn] failed to mint credentials:", e);
    return { servers: STUN_ONLY, turn: false, error: "TURN unavailable" };
  }
}

function peerConfig(req: Request) {
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const url = new URL(req.url);
  const secure =
    process.env.PEER_SECURE !== undefined
      ? process.env.PEER_SECURE === "true"
      : (forwardedProto ?? url.protocol.replace(":", "")) === "https";
  const host =
    process.env.PEER_HOST ||
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host")?.split(":")[0] ||
    url.hostname;
  const port = Number(process.env.PEER_PORT || (secure ? 443 : url.port || 80));
  return {
    host: host.split(":")[0],
    port,
    path: process.env.PEER_PATH || "/peerjs",
    secure,
    key: process.env.PEER_KEY || "peerjs",
  };
}

export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const room = new URL(req.url).searchParams.get("room");
  if (!isRoomId(room)) return NextResponse.json({ error: "Bad room id" }, { status: 400 });

  if (!rateLimit(`turn:${auth.id}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  // Takes (or refreshes) this person's seat. Rooms seat two people for their whole life.
  const seat = joinRoom(room, auth.id);
  if (seat !== "ok") {
    const [error, status] = {
      missing: ["This room doesn't exist", 404],
      ended: ["This room has ended", 410],
      full: ["This room already has two people", 409],
    }[seat] as [string, number];
    return NextResponse.json({ error, reason: seat }, { status });
  }

  const ice = await cloudflareIceServers();
  return NextResponse.json(
    { iceServers: ice.servers, turn: ice.turn, turnError: ice.error, peer: peerConfig(req), ttl: TTL_SECONDS },
    { headers: { "Cache-Control": "no-store" } },
  );
}
