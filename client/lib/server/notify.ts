import "server-only";

/**
 * In-process pub/sub for "your notifications changed" pings, so the navbar
 * bell updates the moment an invite or friend request arrives instead of on
 * the next poll. Clients hold an SSE stream (/api/notifications/stream) and
 * refetch /api/notifications when pinged; the ping itself carries no data.
 *
 * Lives on globalThis so dev-mode module reloads and Next's separate route
 * bundles all share one registry. Single-process only: if this ever runs as
 * several replicas, swap this for Redis pub/sub or similar (polling still
 * covers the gap in the meantime).
 */
type Listener = () => void;
const g = globalThis as typeof globalThis & { __mockifyNotify?: Map<string, Set<Listener>> };
const subs = (g.__mockifyNotify ??= new Map());

export function subscribe(userId: string, fn: Listener): () => void {
  let set = subs.get(userId);
  if (!set) subs.set(userId, (set = new Set()));
  set.add(fn);
  return () => {
    set.delete(fn);
    if (!set.size) subs.delete(userId);
  };
}

export function notify(...userIds: string[]) {
  for (const id of userIds) {
    for (const fn of subs.get(id) ?? []) {
      try {
        fn();
      } catch {
        // A closed stream; its own abort handler unsubscribes it.
      }
    }
  }
}
