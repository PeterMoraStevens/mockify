"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSessionDoc, loadPersisted, persistOnChange } from "@/lib/room/session-doc";
import type { RoomConfig } from "@/lib/room/connection";
import { stopStream, type DevicePrefs } from "@/lib/room/media";
import { Lobby } from "./lobby";
import { RoomView } from "./room-view";
import type { RoomMode } from "@/lib/rooms";

export type RoomUser = { id: string; displayName: string };
export type RoomDeadline = { expiresAt: number; maxExpiresAt: number };

export type JoinedState = {
  stream: MediaStream;
  prefs: DevicePrefs;
  micOn: boolean;
  camOn: boolean;
  config: RoomConfig & { turn: boolean };
};

export function Room({
  roomId,
  user,
  deadline,
  initialMode,
}: {
  roomId: string;
  user: RoomUser;
  deadline: RoomDeadline;
  initialMode: RoomMode;
}) {
  const session = useMemo(() => createSessionDoc(), []);
  const [joined, setJoined] = useState<JoinedState | null>(null);

  // Restore this room's doc from a previous visit (e.g. a refresh). The
  // server copy is merged in too once we're inside (see RoomView).
  useEffect(() => {
    loadPersisted(session.doc, roomId);
    return persistOnChange(session.doc, roomId);
  }, [session.doc, roomId]);

  useEffect(() => () => session.awareness.destroy(), [session.awareness]);

  // Leaving by any route (Leave button, back button, a link) releases the
  // camera and mic. Coming back goes through the lobby, which asks again.
  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    streamRef.current = joined?.stream ?? null;
  }, [joined]);
  useEffect(() => () => stopStream(streamRef.current), []);

  if (!joined) {
    return <Lobby roomId={roomId} user={user} onJoin={setJoined} mode={initialMode} />;
  }
  return (
    <RoomView
      roomId={roomId}
      user={user}
      joined={joined}
      deadline={deadline}
      initialMode={initialMode}
      doc={session.doc}
      awareness={session.awareness}
      onLeave={() => stopStream(joined.stream)}
    />
  );
}
