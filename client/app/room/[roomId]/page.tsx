/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { PlayIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RealtimeCursors } from "@/components/realtime-cursors";
import { RemoteCursorStyles } from "@/components/remote-cursors";
import { useAuth } from "@/hooks/useAuth";
import { RealtimeAvatarStack } from "@/components/realtime-avatar-stack";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Countdown from "react-countdown";
import { useParams, useRouter } from "next/navigation";
import { useYjsEditor } from "@/hooks/use-yjs-editor";
import { MonacoBinding } from "y-monaco";
import { useCurrentUserName } from "@/hooks/use-current-user-name";
import { VideoChat } from "@/components/video-chat";

type PistonLang =
  | "python"
  | "typescript"
  | "javascript"
  | "c++"
  | "java"
  | "c#";

const PISTON_TO_MONACO: Record<PistonLang, string> = {
  python: "python",
  typescript: "typescript",
  javascript: "javascript",
  "c++": "cpp",
  java: "java",
  "c#": "csharp",
};

const LABELS: Record<PistonLang, string> = {
  python: "Python 3",
  typescript: "TypeScript",
  javascript: "JavaScript",
  "c++": "C++ v10.2",
  java: "Java v15",
  "c#": "C#",
};

const PISTON_LANGS: readonly PistonLang[] = [
  "python",
  "typescript",
  "javascript",
  "c++",
  "java",
  "c#",
] as const;

function isPistonLang(v: unknown): v is PistonLang {
  return (
    typeof v === "string" && (PISTON_LANGS as readonly string[]).includes(v)
  );
}

const Page = () => {
  const router = useRouter();
  const theme = useTheme();
  const { roomId } = useParams(); // room code (e.g., "ABC123")
  const supabase = createClient();

  const [language, setLanguage] = useState<PistonLang>("python");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [roomUuid, setRoomUuid] = useState<string>("");
  const [roomClosed, setRoomClosed] = useState<boolean>(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [roomCreatedBy, setRoomCreatedBy] = useState<string | null>(null);
  const [initialCode, setInitialCode] = useState<string | null>(null);

  const channelRef = useRef<any | null>(null);
  const editorRef = useRef<any | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const { user } = useAuth();

  // Yjs collaborative editing
  const { provider } = useYjsEditor({
    roomUuid,
    username: useCurrentUserName(),
  });

  // Fetch room data on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!roomId) return;

      const { data: roomRow, error: roomErr } = await supabase
        .from("rooms")
        .select("id, closed, expires_at, created_by")
        .eq("code", (roomId as string).toUpperCase())
        .single();

      if (roomErr || !roomRow?.id) {
        console.error("fetch rooms error", roomErr);
        toast.error("Room not found or not accessible");
        router.replace("/");
        return;
      }

      const fetchedRoomUuid = roomRow.id as string;
      setRoomUuid(fetchedRoomUuid);
      setExpiresAt(roomRow.expires_at ?? null);
      setRoomCreatedBy(roomRow.created_by ?? null);
      if (roomRow.closed === true) {
        setRoomClosed(true);
        setOutput("Room is closed.");
        localStorage.removeItem("mockify_active_room");
      } else {
        // Save active room for rejoin functionality
        localStorage.setItem(
          "mockify_active_room",
          JSON.stringify({
            code: (roomId as string).toUpperCase(),
            expiresAt: roomRow.expires_at,
          }),
        );
      }

      // Fetch room_state to get initial code, language, output
      const { data, error } = await supabase
        .from("room_state")
        .select("code, updated_at, language, output")
        .eq("room_id", fetchedRoomUuid)
        .single();

      if (error && (error.code as string) !== "PGRST116") {
        console.error("fetch room_state error", error);
        toast.error("Failed to fetch room state");
        return;
      }

      if (mounted && data) {
        if (typeof data.code === "string") setInitialCode(data.code);
        if (isPistonLang(data.language)) setLanguage(data.language);
        if (typeof data.output === "string") setOutput(data.output);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [roomId, router, supabase]);

  useEffect(() => {
    if (!user?.id || !roomCreatedBy) return;
    setIsHost(user.id === roomCreatedBy);
  }, [user?.id, roomCreatedBy]);

  // Bind Yjs to Monaco editor when both are ready
  useEffect(() => {
    if (!provider || !editorRef.current) return;

    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const ytext = provider.doc.getText("monaco");

    // If the Yjs doc is empty and we have initial code from DB, seed it
    if (ytext.length === 0 && initialCode) {
      ytext.insert(0, initialCode);
    }

    const binding = new MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      provider.awareness,
    );

    bindingRef.current = binding;

    return () => {
      binding.destroy();
      bindingRef.current = null;
    };
  }, [provider, initialCode]);

  // Periodic DB persistence for crash recovery (every 5s)
  useEffect(() => {
    if (!roomUuid || !provider || roomClosed) return;

    persistTimerRef.current = window.setInterval(async () => {
      const ytext = provider.doc.getText("monaco");
      const code = ytext.toString();

      await supabase.from("room_state").upsert(
        {
          room_id: roomUuid,
          code,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "room_id" },
      );
    }, 5000);

    return () => {
      if (persistTimerRef.current) {
        window.clearInterval(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [roomUuid, provider, roomClosed, supabase]);

  // Subscribe to language/output broadcasts and room_closed events
  useEffect(() => {
    if (!roomUuid) return;

    const topic = `room:${roomUuid}`;
    const channel = supabase.channel(topic, {
      config: { broadcast: { self: false }, private: true },
    });

    channel.on("broadcast", { event: "language_update" }, (payload) => {
      try {
        const remoteLang = payload?.payload?.language;
        const remoteOutput = payload?.payload?.output;

        if (remoteLang != null && isPistonLang(remoteLang)) {
          setLanguage(remoteLang);
        }
        if (remoteOutput != null) {
          setOutput(remoteOutput);
        }
      } catch (e) {
        console.error("Error applying realtime payload", e);
      }
    });

    channel.on("broadcast", { event: "room_closed" }, async () => {
      setRoomClosed(true);
      setOutput("Room was closed by the host.");
      toast.info("Room closed by host");
      localStorage.removeItem("mockify_active_room");

      try {
        await channel.unsubscribe();
      } catch {}

      router.replace("/");
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("Subscribed to", topic);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("Channel status:", status);
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomUuid, router, supabase]);

  useEffect(() => {
    if (roomClosed) {
      router.replace("/");
    }
  }, [roomClosed, router]);

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const handleCloseRoomClick = async () => {
    if (!roomUuid) return;

    try {
      const res = await fetch("/api/rooms/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: roomUuid }),
      });

      if (!res.ok) {
        const text = await res.text();
        toast.error(`Failed to close room: ${text}`);
        return;
      }

      setRoomClosed(true);
      setOutput("You closed the room.");
      toast.success("Room closed");
      localStorage.removeItem("mockify_active_room");

      setTimeout(() => router.replace("/"), 700);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to close room");
    }
  };

  const handleLanguageChange = async (newLang: PistonLang) => {
    setLanguage(newLang);
    if (!roomUuid || roomClosed) return;

    const { error } = await supabase.from("room_state").upsert(
      {
        room_id: roomUuid,
        language: newLang,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_id" },
    );

    if (error) {
      console.error("Failed to save language:", error);
      toast.error("Failed to save language");
    }

    try {
      channelRef.current?.send({
        type: "broadcast",
        event: "language_update",
        payload: { language: newLang },
      });
    } catch (e) {
      console.warn("Broadcast language failed:", e);
    }
  };

  const handleOutputChange = async (newOutput: string) => {
    if (!roomUuid || roomClosed) return;

    const { error } = await supabase.from("room_state").upsert(
      {
        room_id: roomUuid,
        output: newOutput,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_id" },
    );

    if (error) {
      console.error("Failed to save output:", error);
      toast.error("Failed to save output");
    }

    try {
      channelRef.current?.send({
        type: "broadcast",
        event: "language_update",
        payload: { output: newOutput },
      });
    } catch (e) {
      console.warn("Broadcast output failed:", e);
    }
  };

  const handleCopyRoomCode = async () => {
    const text = (roomId as string | undefined)?.toString()?.toUpperCase();
    if (!text) {
      toast.error("No room code to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${text} to clipboard`);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toast.success(`Copied ${text} to clipboard`);
      } catch (e: any) {
        toast.error("Failed to copy room code");
        console.error(e);
      }
    }
  };

  const handleCodeExecution = async () => {
    if (running || roomClosed) return;

    setRunning(true);
    setOutput("Running...");

    // Get current code from the Yjs document
    const currentCode = provider
      ? provider.doc.getText("monaco").toString()
      : "";

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          content: currentCode,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        setOutput(`Request failed (${res.status}): ${text}`);
        setRunning(false);
        return;
      }

      const data = await res.json();

      if (data.run?.code === null) {
        setOutput("Code timed out");
      } else {
        setOutput(data.run.output);
      }
      handleOutputChange(data.run.output);
    } catch (e: any) {
      setOutput(`Error: ${e?.message ?? "Unknown error"}`);
    } finally {
      setRunning(false);
    }
  };

  const handleRoomClose = () => {
    toast.info("Room expired");
    localStorage.removeItem("mockify_active_room");
    router.replace("/");
  };

  return (
    <div className="grid grid-cols-10 max-h-screen">
      <RemoteCursorStyles awareness={provider?.awareness ?? null} />
      <div className="col-span-7">
        <Card className="p-6 bg-main/80 m-2">
          <CardHeader className="p-0 pb-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base font-medium">Editor</CardTitle>

              <div className="flex gap-2">
                <Select
                  onValueChange={(v) => handleLanguageChange(v as PistonLang)}
                  value={language}
                  disabled={roomClosed}
                >
                  <SelectTrigger className="w-45 shadow-shadow hover:cursor-pointer">
                    <SelectValue placeholder="Select a Language" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectGroup>
                      {(Object.keys(LABELS) as PistonLang[]).map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {LABELS[lang]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <Button
                  onClick={handleCodeExecution}
                  disabled={running || roomClosed}
                >
                  {running ? (
                    <>
                      Running <Spinner />
                    </>
                  ) : (
                    <>
                      Run <PlayIcon />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Editor
              className="shadow-shadow"
              theme={theme.theme === "light" ? "light" : "vs-dark"}
              height="75vh"
              defaultLanguage="python"
              language={PISTON_TO_MONACO[language]}
              onMount={handleEditorMount}
              options={{ readOnly: roomClosed }}
            />
          </CardContent>
        </Card>
      </div>

      <div className="col-span-3 overflow-y-auto max-h-screen">
        <Card className="p-6 bg-main/80 m-2">
          {expiresAt ? (
            <Countdown
              date={new Date(expiresAt)}
              onComplete={handleRoomClose}
              renderer={({ minutes, seconds, completed }) => {
                if (completed)
                  return <div className="text-sm opacity-70">Expired</div>;
                return (
                  <div className="text-sm text-foreground">
                    Expires in{" "}
                    <span className="">
                      {String(minutes).padStart(2, "0")}:
                      {String(seconds).padStart(2, "0")}
                    </span>
                  </div>
                );
              }}
            />
          ) : (
            <div className="text-sm opacity-70">No expiry set</div>
          )}

          <RealtimeAvatarStack roomName={roomUuid} />
          {isHost && (
            <Button variant="neutral" onClick={handleCloseRoomClick}>
              Close room
            </Button>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleCopyRoomCode}>{roomId}</Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Click to Copy</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Card>

        <VideoChat
          roomUuid={roomUuid}
          username={user?.user_metadata?.fullname || "Anonymous"}
        />

        <Card className="overflow-scroll p-6 bg-main/80 m-2 max-h-[55vh]">
          <CardTitle className="text-base font-medium">Output</CardTitle>
          <CardContent className="p-0 pt-4">
            <pre className="whitespace-pre-wrap wrap-break-word">{output}</pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Page;
