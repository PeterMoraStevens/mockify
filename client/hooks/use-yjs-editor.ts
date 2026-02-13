"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as Y from "yjs";
import { createClient } from "@/lib/supabase/client";
import { SupabaseProvider } from "@/lib/yjs/supabase-provider";
import type { RealtimeChannel } from "@supabase/supabase-js";

const generateColor = () =>
  `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;

export function useYjsEditor({
  roomUuid,
  username,
}: {
  roomUuid: string;
  username: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const providerRef = useRef<SupabaseProvider | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [provider, setProvider] = useState<SupabaseProvider | null>(null);
  const [color] = useState(generateColor);

  // Create provider — only depends on roomUuid (stable)
  useEffect(() => {
    if (!roomUuid) return;

    const doc = new Y.Doc();
    const topic = `yjs:${roomUuid}`;
    const channel = supabase.channel(topic, {
      config: { broadcast: { self: false }, private: true },
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        const p = new SupabaseProvider(channel, doc);

        providerRef.current = p;
        channelRef.current = channel;
        setProvider(p);
      }
    });

    return () => {
      providerRef.current?.destroy();
      providerRef.current = null;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setProvider(null);
    };
  }, [roomUuid, supabase]);

  // Update awareness user info whenever username or provider changes
  useEffect(() => {
    if (!provider) return;
    provider.awareness.setLocalStateField("user", {
      name: username || "Anonymous",
      color,
    });
  }, [provider, username, color]);

  return { provider };
}
