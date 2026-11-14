"use client";

import { useEffect, useMemo, useState } from "react";
import { createSessionDoc, loadPersisted, persistOnChange } from "@/lib/room/session-doc";
import type { RoomConfig } from "@/lib/room/connection";
import { stopStream, type DevicePrefs } from "@/lib/room/media";
import { Lobby } from "./lobby";
import { RoomView } from "./room-view";

export type RoomUser = { id: string; displayName: string };

export type JoinedState = {
  stream: MediaStream;
  prefs: DevicePrefs;
  micOn: boolean;
  camOn: boolean;
  config: RoomConfig & { turn: boolean };
};

export function Room({ roomId, user }: { roomId: string; user: RoomUser }) {
  const session = useMemo(() => createSessionDoc(), []);
  const [joined, setJoined] = useState<JoinedState | null>(null);

  // Restore this room's doc from a previous visit (e.g. a refresh).
  useEffect(() => {
    loadPersisted(session.doc, roomId);
    return persistOnChange(session.doc, roomId);
  }, [session.doc, roomId]);

  useEffect(() => () => session.awareness.destroy(), [session.awareness]);

  if (!joined) {
    return <Lobby roomId={roomId} user={user} onJoin={setJoined} />;
  }
  return (
    <RoomView
      roomId={roomId}
      user={user}
      joined={joined}
      doc={session.doc}
      awareness={session.awareness}
      onLeave={() => {
        stopStream(joined.stream);
      }}
    />
  );
}
