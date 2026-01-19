"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RoomState = {
  room_id: string;
  language: string;
  code: string;
  output: string;
  version: number;
  updated_at: string;
  updated_by: string | null;
};

export function useRoomState(roomId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<RoomState | null>(null);
  const lastAppliedVersion = useRef<number>(-1);
  const updateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // initial fetch + realtime subscription
  useEffect(() => {
    let isMounted = true;

    async function init() {
      const { data, error } = await supabase
        .from("room_state")
        .select("*")
        .eq("room_id", roomId)
        .single();

      if (!error && data && isMounted) {
        setState(data as RoomState);
        lastAppliedVersion.current = (data as RoomState).version;
      }
    }

    init();

    const channel = supabase
      .channel(`room_state:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "room_state",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const next = payload.new as RoomState;

          // simple ordering guard
          if (next.version <= lastAppliedVersion.current) return;
          lastAppliedVersion.current = next.version;

          setState(next);
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [roomId, supabase]);

  // debounced update helper (for code typing)
  const updateStateDebounced = (
    patch: Partial<Pick<RoomState, "code" | "language" | "output">>,
    delay = 150,
  ) => {
    if (!state) return;

    if (updateTimer.current) clearTimeout(updateTimer.current);
    updateTimer.current = setTimeout(async () => {
      // increment version
      const nextVersion = (state.version ?? 0) + 1;

      const { error } = await supabase
        .from("room_state")
        .update({ ...patch, version: nextVersion })
        .eq("room_id", roomId)
        .eq("version", state.version); // optimistic concurrency

      // If conflict happens (someone else updated), just refetch:
      if (error) {
        const { data } = await supabase
          .from("room_state")
          .select("*")
          .eq("room_id", roomId)
          .single();
        if (data) {
          setState(data as RoomState);
          lastAppliedVersion.current = (data as RoomState).version;
        }
      }
    }, delay);
  };

  return { state, setState, updateStateDebounced };
}
