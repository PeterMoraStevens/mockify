/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Copy, PlayIcon } from "lucide-react";
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
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RealtimeCursors } from "@/components/realtime-cursors";
import { useAuth } from "@/hooks/useAuth";
import { RealtimeAvatarStack } from "@/components/realtime-avatar-stack";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Countdown from "react-countdown";
import { useParams, useRouter, redirect } from "next/navigation";

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

const Page = () => {
  const router = useRouter();
  const theme = useTheme();
  const { roomId } = useParams(); // room code (e.g., "ABC123")
  const supabase = createClient();

  const [code, setCode] = useState<string>("");
  const [language, setLanguage] = useState<PistonLang>("python");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [roomUuid, setRoomUuid] = useState<string>("");
  const [roomClosed, setRoomClosed] = useState<boolean>(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [roomCreatedBy, setRoomCreatedBy] = useState<string | null>(null);

  const typingTimeoutRef = useRef<number | null>(null);
  const channelRef = useRef<any | null>(null);
  const isApplyingRemoteRef = useRef(false);
  const { user, loading } = useAuth();

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
      }

      // Fetch room_state by room_uuid
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
        if (typeof data.code === "string") setCode(data.code);
        if (isPistonLang(data.language)) setLanguage(data.language);
        if (typeof data.output === "string") setOutput(data.output);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [roomId, supabase]);

  useEffect(() => {
    if (!user?.id || !roomCreatedBy) return;
    setIsHost(user.id === roomCreatedBy);
  }, [user?.id, roomCreatedBy]);

  // Subscribe to realtime broadcasts for this roomUuid (UUID topic)
  useEffect(() => {
    if (!roomUuid) return;

    const topic = `room:${roomUuid}`;
    const channel = supabase.channel(topic, {
      config: { broadcast: { self: true }, private: true },
    });

    channel.on("broadcast", { event: "*" }, (payload) => {
      try {
        const body = payload?.payload ?? payload;
        const maybeNew = body?.new ?? body?.record ?? body;

        // Handle code/language updates (existing logic)
        const remoteCode =
          maybeNew?.code ??
          maybeNew?.content ??
          maybeNew?.payload?.code ??
          null;
        const remoteLang =
          maybeNew?.language ?? maybeNew?.payload?.language ?? null;
        const remoteOutput = maybeNew?.output ?? "";

        if (remoteCode != null) {
          isApplyingRemoteRef.current = true;
          setCode(remoteCode);
          isApplyingRemoteRef.current = false;
        }

        if (remoteLang != null) {
          setLanguage(remoteLang);
        }

        if (remoteOutput !== "") {
          setOutput(remoteOutput);
        }
      } catch (e) {
        console.error("Error applying realtime payload", e);
      }
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("Subscribed to", topic);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("Channel status:", status);
      }
    });

    channelRef.current = channel;

    channel.on("broadcast", { event: "room_closed" }, async () => {
      setRoomClosed(true);
      setOutput("Room was closed by the host.");
      toast.info("Room closed by host");

      try {
        await channel.unsubscribe();
      } catch {}

      router.replace("/");
    });

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

      // Host UX: you can either stay, or also redirect out.
      setRoomClosed(true);
      setOutput("You closed the room.");
      toast.success("Room closed");

      setTimeout(() => router.replace("/"), 700);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to close room");
    }
  };

  // Debounced save to DB when local code changes
  const scheduleSave = (newContent: string) => {
    if (isApplyingRemoteRef.current) return;
    if (!roomUuid) return;
    if (roomClosed) return; // NEW: don't save if room is closed

    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = window.setTimeout(async () => {
      const payload = {
        room_id: roomUuid,
        code: newContent,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("room_state")
        .upsert(payload, { onConflict: "room_id" });

      if (error) {
        console.error("Failed to save room_state:", error);
        toast.error("Failed to save edits");
      }
      typingTimeoutRef.current = null;
    }, 700);
  };

  const onEditorChange = (value?: string) => {
    const newValue = value ?? "";
    setCode(newValue);
    scheduleSave(newValue);
  };

  const handleLanguageChange = async (newLang: PistonLang) => {
    setLanguage(newLang);
    if (!roomUuid || roomClosed) return; // avoid changes if closed

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

    // Optional: broadcast immediately
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
      console.error("Failed to save language:", error);
      toast.error("Failed to save language");
    }

    // Optional: broadcast immediately
    try {
      channelRef.current?.send({
        type: "broadcast",
        event: "language_update",
        payload: { output: newOutput },
      });
    } catch (e) {
      console.warn("Broadcast language failed:", e);
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
      // Fallback for older browsers / insecure contexts
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

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          content: code ?? "",
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
    router.replace("/");
  };

  return (
    <div className="grid grid-cols-10 max-h-screen">
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
              value={code}
              onChange={onEditorChange}
              options={{ readOnly: roomClosed }}
            />
          </CardContent>
        </Card>
      </div>

      <div className="col-span-3 h-[75vh]">
        <Card className="p-6 bg-main/80 m-2">
          <RealtimeCursors
            roomName={roomUuid}
            username={user?.user_metadata.fullname}
          />
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
