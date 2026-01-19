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
import { redirect, useParams } from "next/navigation";
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

const Page = () => {
  const theme = useTheme();
  const { roomId } = useParams(); // room code (e.g., "ABC123")
  const supabase = createClient();

  const [code, setCode] = useState<string>("");
  const [language, setLanguage] = useState("python");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);

  const [roomUuid, setRoomUuid] = useState<string>("");
  const [roomClosed, setRoomClosed] = useState<boolean>(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const typingTimeoutRef = useRef<number | null>(null);
  const channelRef = useRef<any | null>(null);
  const isApplyingRemoteRef = useRef(false);
  const { user, loading } = useAuth();

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!roomId) return;

      const { data: roomRow, error: roomErr } = await supabase
        .from("rooms")
        .select("id, closed, expires_at")
        .eq("code", (roomId as string).toUpperCase())
        .single();

      if (roomErr || !roomRow?.id) {
        console.error("fetch rooms error", roomErr);
        toast.error("Room not found or not accessible");
        redirect("/");
      }

      const fetchedRoomUuid = roomRow.id as string;
      setRoomUuid(fetchedRoomUuid);
      setExpiresAt(roomRow.expires_at ?? null);
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
        if (typeof data.language === "string") setLanguage(data.language);
        if (typeof data.output === "string") setOutput(data.output);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [roomId, supabase]);

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

        if (remoteCode != null) {
          isApplyingRemoteRef.current = true;
          setCode(remoteCode);
          isApplyingRemoteRef.current = false;
        }

        if (remoteLang != null) {
          setLanguage(remoteLang);
        }

        // NEW: handle room_closed broadcast specifically
        // The cron function sends via realtime.send(topic, 'room_closed', { room_id }, true);
        // Supabase broadcast payload shape usually puts the event name as payload?.event or top-level event
        const eventName = payload?.event ?? body?.event ?? null;
        const evt = (eventName || payload?.type || null)?.toString();

        if (evt === "room_closed" || body?.event === "room_closed") {
          // Mark UI as closed and show output + toast
          setRoomClosed(true);
          const closedMsg =
            body?.payload?.room_id ??
            maybeNew?.room_id ??
            `Room ${roomUuid} was closed`;
          const message = `Room closed by scheduler (${closedMsg})`;
          setOutput(message);
          toast.info(`Room closed by scheduler`);
        }

        // Some broadcasts may include payload directly as { event, payload }, handle that too
        if (body?.event === "room_closed" && body?.payload) {
          setRoomClosed(true);
          const message = `Room closed by scheduler (${body.payload.room_id})`;
          setOutput(message);
          toast.info(message);
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

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomUuid, supabase]);

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

  const handleLanguageChange = async (newLang: string) => {
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
    } catch (e: any) {
      setOutput(`Error: ${e?.message ?? "Unknown error"}`);
    } finally {
      setRunning(false);
    }
  };

  const handleRoomClose = () => {
    toast.info("Room expired");
    redirect("/");
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
                  onValueChange={handleLanguageChange}
                  value={language}
                  disabled={roomClosed}
                >
                  <SelectTrigger className="w-45 shadow-shadow hover:cursor-pointer">
                    <SelectValue placeholder="Select a Language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="python">Python 3</SelectItem>
                      <SelectItem value="typescript">TypeScript</SelectItem>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                      <SelectItem value="c++">C++ v10.2</SelectItem>
                      <SelectItem value="java">Java v15</SelectItem>
                      <SelectItem value="c#">C#</SelectItem>
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
              theme={theme.theme === "dark" ? "vs-dark" : "light"}
              height="75vh"
              defaultLanguage="python"
              language={language}
              value={code}
              onChange={onEditorChange}
              options={{ readOnly: roomClosed }}
            />
          </CardContent>
        </Card>
      </div>

      <div className="col-span-3">
        <Card className="h-[25vh] p-6 bg-main/80 m-2">
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

        <Card className="h-[60vh] overflow-scroll p-6 bg-main/80 m-2">
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
