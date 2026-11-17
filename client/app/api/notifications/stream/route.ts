import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { subscribe } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events: sends "changed" whenever this user's invites or friend
 * requests change. The client refetches /api/notifications on each one.
 */
export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          cleanup();
        }
      };
      // Tell EventSource to wait 5s before reconnecting after a drop.
      send("retry: 5000\n\n");
      const unsubscribe = subscribe(auth.id, () => send("data: changed\n\n"));
      // Comment lines keep proxies (Traefik, cloudflared) from closing an idle stream.
      const ping = setInterval(() => send(": ping\n\n"), 25_000);
      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
