"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import type { PresenceState, Slot } from "./session-doc";

type Observable = Pick<Y.AbstractType<never>, "observeDeep" | "unobserveDeep">;

/** Re-read `read()` whenever the Y type (or anything nested in it) changes. */
export function useY<T>(type: Observable, read: () => T): T {
  const [value, setValue] = useState(read);
  useEffect(() => {
    const update = () => setValue(read());
    type.observeDeep(update);
    update();
    return () => type.unobserveDeep(update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);
  return value;
}

/** The other person's presence (name, mute state, …), or null if they're not here. */
export function useRemotePresence(awareness: Awareness, mySlot: Slot | null): PresenceState | null {
  const [state, setState] = useState<PresenceState | null>(null);
  useEffect(() => {
    const update = () => {
      let found: PresenceState | null = null;
      awareness.getStates().forEach((s, id) => {
        if (id !== awareness.clientID && s && (s as PresenceState).slot && (s as PresenceState).slot !== mySlot) {
          found = s as PresenceState;
        }
      });
      setState(found);
    };
    awareness.on("change", update);
    update();
    return () => awareness.off("change", update);
  }, [awareness, mySlot]);
  return state;
}

/** Ticks every `ms` so countdowns re-render. */
export function useNow(ms = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(iv);
  }, [ms]);
  return now;
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}
