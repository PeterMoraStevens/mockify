// Room IDs are the only secret protecting a room, so they're long and random.
// 20 base36 chars ≈ 103 bits. PeerJS IDs are derived as `mockify-<room>-<slot>`.

const ROOM_ID_RE = /^[a-z0-9]{20}$/;

export function isRoomId(v: unknown): v is string {
  return typeof v === "string" && ROOM_ID_RE.test(v);
}

export function newRoomId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  // 252 = 36 * 7, so rejecting >= 252 keeps the distribution uniform.
  let out = "";
  while (out.length < 20) {
    for (const b of bytes) {
      if (b < 252 && out.length < 20) out += alphabet[b % 36];
    }
    crypto.getRandomValues(bytes);
  }
  return out;
}
