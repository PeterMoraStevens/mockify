"use client";

import { useState, useCallback } from "react";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  TrackToggle,
  useTracks,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Video, VideoOff, Mic, MicOff, PhoneOff, Phone } from "lucide-react";

function VideoTiles() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <GridLayout tracks={tracks} style={{ height: "100%" }}>
      <ParticipantTile />
    </GridLayout>
  );
}

export function VideoChat({
  roomUuid,
  username,
}: {
  roomUuid: string;
  username: string;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  const handleJoinCall = useCallback(async () => {
    if (!roomUuid) return;
    setLoading(true);

    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: roomUuid }),
      });

      if (!res.ok) {
        console.error("Failed to get LiveKit token");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setToken(data.token);
      setJoined(true);
    } catch (e) {
      console.error("Failed to join call:", e);
    } finally {
      setLoading(false);
    }
  }, [roomUuid]);

  const handleLeaveCall = useCallback(() => {
    setToken(null);
    setJoined(false);
  }, []);

  if (!livekitUrl) {
    return null;
  }

  return (
    <Card className="p-4 bg-main/80 m-2">
      <CardTitle className="text-base font-medium mb-2">Video Chat</CardTitle>
      <CardContent className="p-0">
        {!joined ? (
          <Button
            onClick={handleJoinCall}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              "Connecting..."
            ) : (
              <>
                Join Call <Phone className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        ) : token ? (
          <div data-lk-theme="default">
            <LiveKitRoom
              serverUrl={livekitUrl}
              token={token}
              connect={true}
              video={true}
              audio={true}
              onDisconnected={handleLeaveCall}
              style={{ height: "auto" }}
            >
              <div
                className="rounded overflow-hidden"
                style={{ height: "200px", aspectRatio: "1:1" }}
              >
                <VideoTiles />
              </div>
              <RoomAudioRenderer />
              <div className="flex gap-2 mt-2 justify-center">
                <TrackToggle source={Track.Source.Microphone}></TrackToggle>
                <TrackToggle source={Track.Source.Camera}></TrackToggle>
                <Button
                  variant="noShadow"
                  size="icon"
                  onClick={handleLeaveCall}
                >
                  <PhoneOff className="h-4 w-4" />
                </Button>
              </div>
            </LiveKitRoom>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
