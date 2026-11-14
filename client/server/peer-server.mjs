// PeerJS signaling server. It only brokers WebRTC offers/answers/ICE between
// the two browsers in a room. No media, editor or code goes through it.
//
//   PEER_SERVER_PORT  port to listen on            (default 9000)
//   PEER_PATH         mount path, must match the app (default /peerjs)
//   PEER_KEY          API key, must match the app    (default peerjs)

import { PeerServer } from "peer";

const port = Number(process.env.PEER_SERVER_PORT ?? 9000);
const path = process.env.PEER_PATH ?? "/peerjs";
const key = process.env.PEER_KEY ?? "peerjs";

// Only accept the IDs Mockify generates: mockify-<20 base36 chars>-<a|b>.
const ID_RE = /^mockify-[a-z0-9]{20}-[ab]$/;

const server = PeerServer({
  port,
  path,
  key,
  proxied: true, // behind cloudflared / a reverse proxy
  allow_discovery: false, // never list connected peers
  alive_timeout: 30_000,
  concurrent_limit: 5000,
  generateClientId: () => `rejected-${Math.random().toString(36).slice(2)}`,
});

server.on("connection", (client) => {
  const id = client.getId();
  if (!ID_RE.test(id)) {
    console.warn(`[peer] rejecting unexpected id ${id}`);
    client.getSocket()?.close();
  }
});

console.log(`[peer] signaling server on :${port}${path} (key "${key}")`);

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => process.exit(0));
}
