"use client";

import { Code2, GripVertical, GripHorizontal, PenTool, Play, RotateCcw, Send } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { toast } from "sonner";
import type * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs } from "@/components/ui/tabs";
import { LANGUAGE_IDS, LANGUAGES, SCRATCH_STARTERS, isLanguageId, type LanguageId } from "@/lib/languages";
import type { InterviewerProblem, ProblemSummary, PublicProblem } from "@/lib/problems/schema";
import type { EditorView } from "@codemirror/view";
import { RoomConnection, type ConnSnapshot } from "@/lib/room/connection";
import { useMediaQuery, useNow, useRemotePresence, useY } from "@/lib/room/hooks";
import { blackVideoTrack, isSynthetic, saveMediaToggles, stopStream } from "@/lib/room/media";
import {
  SLOT_COLORS,
  applyEncoded,
  encodeDoc,
  getCode,
  getRun,
  getSession,
  getSharedNotes,
  otherSlot,
  readRun,
  readSession,
  replaceCode,
  roleOf,
  type EndedState,
  type PresenceState,
  type RunResult,
  type SharedNote,
} from "@/lib/room/session-doc";
import { ROOM_WARN_MS, type RoomMode } from "@/lib/rooms";
import type { RunMode, RunResponse } from "@/lib/run-types";
import { cn } from "@/lib/utils";
import { CodeEditor } from "./code-editor";
import { EndConfirmDialog, WrapUpDialog } from "./conclude-dialog";
import { InviteDialog } from "./invite-dialog";
import { OutputPanel } from "./output-panel";
import { RemotePointer, usePointerSync } from "./pointers";
import { ProblemPanel, type NotesProps } from "./problem-panel";
import type { JoinedState, RoomDeadline, RoomUser } from "./room";
import { RoomHeader } from "./room-header";
import { VideoPanel } from "./video-panel";
import type { BoardPointer } from "./whiteboard";

const Whiteboard = dynamic(() => import("./whiteboard"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center">
      <Spinner />
    </div>
  ),
});

const INITIAL_SNAPSHOT: ConnSnapshot = {
  status: "init",
  slot: null,
  error: null,
  remoteStream: null,
  path: null,
  rttMs: null,
  clockOffsetMs: 0,
};
const noopSubscribe = () => () => {};
const AUTOSAVE_MS = 20_000;

export type AnyProblem = PublicProblem | InterviewerProblem;

export function RoomView({
  roomId,
  user,
  joined,
  deadline: initialDeadline,
  initialMode,
  doc,
  awareness,
  onLeave,
}: {
  roomId: string;
  user: RoomUser;
  joined: JoinedState;
  deadline: RoomDeadline;
  initialMode: RoomMode;
  doc: Y.Doc;
  awareness: Awareness;
  onLeave: () => void;
}) {
  const router = useRouter();
  const wide = useMediaQuery("(min-width: 1024px)");

  // ------------------------------------------------------------ connection
  const [conn, setConn] = useState<RoomConnection | null>(null);
  useEffect(() => {
    const c = new RoomConnection(joined.config, doc, awareness, joined.stream);
    // Deferred so React StrictMode's mount→unmount→mount in dev doesn't
    // briefly claim a slot and then release it.
    const t = window.setTimeout(() => {
      setConn(c);
      c.start();
    }, 0);
    const bye = () => c.destroy();
    window.addEventListener("pagehide", bye);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pagehide", bye);
      c.destroy();
    };
  }, [joined, doc, awareness]);

  const snap = useSyncExternalStore(
    conn?.subscribe ?? noopSubscribe,
    conn?.getSnapshot ?? (() => INITIAL_SNAPSHOT),
    () => INITIAL_SNAPSHOT,
  );
  const slot = snap.slot;
  const remote = useRemotePresence(awareness, slot);

  // ---------------------------------------------------------- shared state
  const session = useY(getSession(doc), () => readSession(doc));
  const run = useY(getRun(doc), () => readRun(doc));
  const role = slot ? roleOf(slot, session.interviewerSlot) : null;
  // Coding vs. system design: shared in the doc so both people switch together.
  const mode: RoomMode = session.mode ?? initialMode;
  const setMode = useCallback(
    (m: RoomMode) => {
      getSession(doc).set("mode", m);
      toast(m === "design" ? "Switched to system design: whiteboard only" : "Switched to coding");
    },
    [doc],
  );
  const isInterviewer = role === "interviewer";

  // ----------------------------------------------------------------- media
  const [micOn, setMicOn] = useState(joined.micOn);
  const [camOn, setCamOn] = useState(joined.camOn);
  const [sharing, setSharing] = useState(false);
  const [localVideo, setLocalVideo] = useState<MediaStreamTrack | null>(() => joined.stream.getVideoTracks()[0] ?? null);
  const screenTrack = useRef<MediaStreamTrack | null>(null);
  const camOnRef = useRef(camOn);
  useEffect(() => {
    camOnRef.current = camOn;
  }, [camOn]);

  useEffect(() => {
    if (!slot) return;
    const presence: PresenceState = {
      user: { name: user.displayName, ...SLOT_COLORS[slot] },
      userId: user.id,
      slot,
      muted: !micOn,
      cameraOff: !camOn,
      sharing,
    };
    awareness.setLocalState(presence);
  }, [awareness, slot, user, micOn, camOn, sharing]);

  const toggleMic = () => {
    const t = joined.stream.getAudioTracks()[0];
    if (!t || isSynthetic(t)) {
      toast.error("No microphone available");
      return;
    }
    t.enabled = !micOn;
    setMicOn(!micOn);
    saveMediaToggles({ micOn: !micOn, camOn });
  };

  const cameraTrack = useCallback(async (): Promise<MediaStreamTrack | null> => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: joined.prefs.videoId ? { exact: joined.prefs.videoId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      return s.getVideoTracks()[0];
    } catch {
      return null;
    }
  }, [joined.prefs.videoId]);

  const swapVideo = useCallback(
    async (track: MediaStreamTrack) => {
      const old = conn
        ? await conn.replaceTrack("video", track)
        : (() => {
            const o = joined.stream.getVideoTracks()[0];
            if (o) joined.stream.removeTrack(o);
            joined.stream.addTrack(track);
            return o;
          })();
      if (old && old !== screenTrack.current) old.stop();
      setLocalVideo(track);
    },
    [conn, joined.stream],
  );

  const toggleCam = async () => {
    saveMediaToggles({ micOn, camOn: !camOn });
    if (camOn) {
      setCamOn(false);
      if (!sharing) await swapVideo(blackVideoTrack());
    } else {
      if (sharing) {
        setCamOn(true);
        return;
      }
      const t = await cameraTrack();
      if (!t) {
        toast.error("Couldn't start the camera");
        return;
      }
      setCamOn(true);
      await swapVideo(t);
    }
  };

  const stopShare = useCallback(async () => {
    const st = screenTrack.current;
    screenTrack.current = null;
    setSharing(false);
    const next = camOnRef.current ? ((await cameraTrack()) ?? blackVideoTrack()) : blackVideoTrack();
    await swapVideo(next);
    st?.stop();
  }, [cameraTrack, swapVideo]);

  const toggleShare = async () => {
    if (sharing) {
      await stopShare();
      return;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15 } }, audio: false });
      const track = s.getVideoTracks()[0];
      track.contentHint = "detail";
      screenTrack.current = track;
      track.addEventListener("ended", () => {
        if (screenTrack.current === track) stopShare();
      });
      setSharing(true);
      await swapVideo(track);
    } catch {
      /* user cancelled the picker */
    }
  };

  const leave = (to = "/rooms") => {
    saveNow(true);
    conn?.destroy();
    screenTrack.current?.stop();
    stopStream(joined.stream);
    onLeave();
    router.push(to);
  };

  // ------------------------------------------------------- server autosave
  // The server keeps a merged copy of the doc: rejoining from another browser
  // restores it, and the interview summary shows the final code/whiteboard.
  const dirty = useRef(false);
  const saveNow = useCallback(
    (beacon = false) => {
      if (!dirty.current && !beacon) return;
      dirty.current = false;
      const body = JSON.stringify({ ydoc: encodeDoc(doc) });
      if (beacon && navigator.sendBeacon?.(`/api/rooms/${roomId}/state`, body)) return;
      fetch(`/api/rooms/${roomId}/state`, { method: "PUT", headers: { "Content-Type": "application/json" }, body })
        .then((r) => {
          if (!r.ok && r.status !== 410) dirty.current = true;
        })
        .catch(() => {
          dirty.current = true;
        });
    },
    [doc, roomId],
  );
  useEffect(() => {
    const onUpdate = (_u: Uint8Array, origin: unknown) => {
      if (origin !== "server") dirty.current = true;
    };
    doc.on("update", onUpdate);
    const iv = window.setInterval(() => saveNow(), AUTOSAVE_MS);
    const onHide = () => saveNow(true);
    window.addEventListener("pagehide", onHide);
    return () => {
      doc.off("update", onUpdate);
      window.clearInterval(iv);
      window.removeEventListener("pagehide", onHide);
    };
  }, [doc, saveNow]);

  // ----------------------------------------------------------------- notes
  const [notesText, setNotesText] = useState("");
  const [shareNotes, setShareNotes] = useState(false);
  const [notesSaving, setNotesSaving] = useState<NotesProps["saving"]>("idle");
  const notesLoaded = useRef(false);

  // Pull the saved doc and my notes once we're in.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rooms/${roomId}/state`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { ydoc: string | null; notes: string; shareNotes: boolean } | null) => {
        if (cancelled || !b) return;
        if (b.ydoc) applyEncoded(doc, b.ydoc, "server");
        setNotesText((t) => t || b.notes);
        setShareNotes(b.shareNotes);
      })
      .catch(() => {})
      .finally(() => {
        notesLoaded.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [doc, roomId]);

  const saveNotes = useCallback(
    async (text: string, shared: boolean) => {
      setNotesSaving("saving");
      try {
        const r = await fetch(`/api/rooms/${roomId}/notes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text, shared }),
          keepalive: text.length < 60_000,
        });
        setNotesSaving(r.ok ? "saved" : "error");
      } catch {
        setNotesSaving("error");
      }
    },
    [roomId],
  );

  useEffect(() => {
    if (!notesLoaded.current) return;
    const t = window.setTimeout(() => saveNotes(notesText, shareNotes), 1200);
    return () => window.clearTimeout(t);
  }, [notesText, shareNotes, saveNotes]);

  // Shared notes are mirrored into the doc so the other person reads them live.
  useEffect(() => {
    const map = getSharedNotes(doc);
    if (!shareNotes) {
      if (map.has(user.id)) map.delete(user.id);
      return;
    }
    const t = window.setTimeout(() => {
      map.set(user.id, { name: user.displayName, text: notesText, at: Date.now() });
    }, 500);
    return () => window.clearTimeout(t);
  }, [doc, shareNotes, notesText, user.id, user.displayName]);

  const sharedNotes = useY(getSharedNotes(doc), () => Object.fromEntries(getSharedNotes(doc).entries()) as Record<string, SharedNote>);
  const partnerNote = Object.entries(sharedNotes).find(([id]) => id !== user.id)?.[1] ?? null;

  // -------------------------------------------------------------- problems
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [fetched, setFetched] = useState<{ key: string; problem: AnyProblem | null } | null>(null);
  const problemKey = session.problemSlug ? `${session.problemSlug}:${isInterviewer ? "i" : "p"}` : null;
  // Keep showing the last problem while the interviewer view loads after a role swap.
  const problem =
    fetched && session.problemSlug && fetched.key.startsWith(`${session.problemSlug}:`) ? fetched.problem : null;
  useEffect(() => {
    fetch("/api/problems")
      .then((r) => r.json())
      .then((b) => setProblems(b.problems ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!problemKey) return;
    const [slug, view] = problemKey.split(":");
    let cancelled = false;
    fetch(`/api/problems/${slug}${view === "i" ? "?view=interviewer" : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => !cancelled && setFetched({ key: problemKey, problem: p }))
      .catch(() => !cancelled && setFetched({ key: problemKey, problem: null }));
    return () => {
      cancelled = true;
    };
  }, [problemKey]);

  const availableLanguages: LanguageId[] = problem
    ? (Object.keys(problem.starters).filter(isLanguageId) as LanguageId[])
    : [...LANGUAGE_IDS];

  const starterFor = useCallback(
    (lang: LanguageId, p: AnyProblem | null = problem) => p?.starters[lang] ?? SCRATCH_STARTERS[lang],
    [problem],
  );

  const pickProblem = async (slug: string | null) => {
    if (!slug) {
      doc.transact(() => {
        getSession(doc).delete("problemSlug");
        getRun(doc).delete("tests");
        getRun(doc).delete("custom");
      });
      return;
    }
    const res = await fetch(`/api/problems/${slug}`);
    if (!res.ok) {
      toast.error("Couldn't load that problem");
      return;
    }
    const p = (await res.json()) as PublicProblem;
    const langs = Object.keys(p.starters).filter(isLanguageId) as LanguageId[];
    const lang = langs.includes(session.language) ? session.language : langs[0];
    doc.transact(() => {
      const s = getSession(doc);
      s.set("problemSlug", slug);
      s.set("language", lang);
      replaceCode(doc, p.starters[lang] ?? SCRATCH_STARTERS[lang]);
      getRun(doc).delete("tests");
      getRun(doc).delete("custom");
    });
    toast.success(`Problem set: ${p.title}`);
  };

  const changeLanguage = (lang: LanguageId) => {
    if (lang === session.language) return;
    const code = getCode(doc).toString();
    const untouched = code.trim() === "" || code === starterFor(session.language);
    doc.transact(() => {
      getSession(doc).set("language", lang);
      if (untouched) replaceCode(doc, starterFor(lang));
    });
    if (!untouched) toast.info(`Kept your code. Use Reset to load the ${LANGUAGES[lang].label} starter.`);
  };

  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    if (!confirmReset) return;
    const t = window.setTimeout(() => setConfirmReset(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirmReset]);
  const resetCode = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    replaceCode(doc, starterFor(session.language));
  };

  // ------------------------------------------------------------------- run
  const [localRunning, setLocalRunning] = useState(false);
  const [stdin, setStdin] = useState("");
  const [outputTab, setOutputTab] = useState<"tests" | "custom">("tests");

  // A run started by someone who has since left (or by us before a refresh) is stale.
  const otherRunning = run.runningBy !== null && run.runningBy !== slot && remote?.slot === run.runningBy;
  const busy = localRunning || otherRunning;

  const runCode = useCallback(
    async (requested: RunMode) => {
      if (!slot || busy) return;
      const mode: RunMode = !session.problemSlug || (requested === "run" && outputTab === "custom") ? "custom" : requested;
      const r = getRun(doc);
      setLocalRunning(true);
      doc.transact(() => {
        r.set("runningBy", slot);
        r.set("runningMode", mode);
      });
      if (mode === "custom") setOutputTab("custom");
      else setOutputTab("tests");

      let last: RunResult;
      const meta = { by: slot, byName: user.displayName, at: Date.now(), language: session.language };
      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            slug: session.problemSlug ?? undefined,
            language: session.language,
            code: getCode(doc).toString(),
            stdin: mode === "custom" ? stdin : undefined,
          }),
        });
        const body = await res.json().catch(() => ({}));
        last = res.ok
          ? { ...(body as RunResponse), ...meta }
          : { mode, results: [], summary: { passed: 0, total: 0 }, error: body.error ?? `Run failed (${res.status})`, ...meta };
      } catch {
        last = { mode, results: [], summary: { passed: 0, total: 0 }, error: "Network error", ...meta };
      }
      doc.transact(() => {
        r.set(last.mode === "custom" ? "custom" : "tests", last);
        r.set("runningBy", null);
        r.set("runningMode", null);
      });
      setLocalRunning(false);
      if (last.mode === "submit" && !last.error && !last.compileError) {
        const { passed, total } = last.summary;
        if (passed === total) toast.success(`All ${total} tests passed!`);
        else toast.error(`${passed}/${total} tests passed`);
      }
    },
    [slot, busy, session.problemSlug, session.language, outputTab, doc, user.displayName, stdin],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        runCode(e.shiftKey ? "submit" : "run");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runCode]);

  // ------------------------------------------------------------------ swap
  const swapRoles = () => {
    getSession(doc).set("interviewerSlot", session.interviewerSlot === "a" ? "b" : "a");
  };
  const prevRole = useRef(role);
  useEffect(() => {
    if (prevRole.current && role && prevRole.current !== role) {
      toast.info(role === "interviewer" ? "You're the interviewer now" : "You're the candidate now");
    }
    prevRole.current = role;
  }, [role]);

  // ------------------------------------------------------- room deadline
  const [deadline, setDeadline] = useState(initialDeadline);
  // An extension by the other person arrives through the doc right away…
  const expiresAt = Math.max(deadline.expiresAt, session.expiresAt ?? 0);
  // …and from the server every so often, in case the doc missed it.
  useEffect(() => {
    const iv = window.setInterval(async () => {
      const r = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" }).catch(() => null);
      if (!r?.ok) return;
      const b = (await r.json()) as { expiresAt: number; maxExpiresAt: number };
      setDeadline({ expiresAt: b.expiresAt, maxExpiresAt: b.maxExpiresAt });
    }, 30_000);
    return () => window.clearInterval(iv);
  }, [roomId]);

  const extend = async (minutes: number) => {
    const r = await fetch(`/api/rooms/${roomId}/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes }),
    });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast.error(b.error ?? "Couldn't extend the room");
      return;
    }
    setDeadline({ expiresAt: b.expiresAt, maxExpiresAt: b.maxExpiresAt });
    getSession(doc).set("expiresAt", b.expiresAt);
    toast.success(`Room extended by ${minutes} minutes`);
  };

  // ------------------------------------------------------------ wrap-up
  const ended: EndedState | null = session.ended;
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [lastPartner, setLastPartner] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- remember who we were with after they leave
    if (remote) setLastPartner(remote.user.name);
  }, [remote]);
  const partnerName = remote?.user.name ?? lastPartner;

  const endInterview = useCallback(
    async (reason: EndedState["reason"]) => {
      if (!slot) return;
      setEnding(true);
      saveNow(true);
      await fetch(`/api/rooms/${roomId}/conclude`, { method: "POST" }).catch(() => {});
      getSession(doc).set("ended", { by: slot, byName: user.displayName, at: Date.now(), reason } satisfies EndedState);
      setEnding(false);
      setConfirmEnd(false);
    },
    [slot, saveNow, roomId, doc, user.displayName],
  );

  const finish = async () => {
    await saveNotes(notesText, shareNotes);
    leave(`/interviews/${roomId}`);
  };

  // ------------------------------------------------------ invite + pointers
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const remotePtr = usePointerSync(conn, editorView);
  const remoteColor = slot ? SLOT_COLORS[otherSlot(slot)].color : "#888";
  const [boardPtr, setBoardPtr] = useState<BoardPointer | null>(null);
  useEffect(() => {
    if (!conn) return;
    return conn.onEphemeral((m) => {
      if (m.k !== "ptr") return;
      // Pointer moved to another panel: drop it from the board.
      if (m.panel !== "board-scene") setBoardPtr(null);
    });
  }, [conn]);
  useEffect(() => {
    if (!conn) return;
    return conn.onEphemeral((m) => {
      if (m.k === "ptr" && m.panel === "board-scene") {
        setBoardPtr({ x: m.x, y: m.y, name: remote?.user.name ?? "Partner", color: remoteColor });
      }
    });
  }, [conn, remote?.user.name, remoteColor]);
  const sendBoardPointer = useCallback(
    (p: { x: number; y: number } | null) => {
      if (!conn) return;
      conn.sendEphemeral(p ? { k: "ptr", panel: "board-scene", x: p.x, y: p.y } : { k: "ptr", panel: null });
    },
    [conn],
  );

  // ---------------------------------------------------------------- layout
  const [centerTab, setCenterTab] = useState<"code" | "board">("code");
  const ytext = useMemo(() => getCode(doc), [doc]);

  if (snap.status === "full" || snap.status === "error") {
    return <BlockingMessage status={snap.status} error={snap.error} onLeave={() => leave("/rooms")} />;
  }

  const notes: NotesProps = {
    text: notesText,
    onText: setNotesText,
    shared: shareNotes,
    onShared: setShareNotes,
    saving: notesSaving,
    partnerNote,
  };

  const header = (
    <RoomHeader
      doc={doc}
      snap={snap}
      role={role}
      deadline={{ expiresAt, maxExpiresAt: deadline.maxExpiresAt }}
      onExtend={extend}
      mode={mode}
      onMode={setMode}
      onSwap={swapRoles}
      onInvite={() => setInviteOpen(true)}
      onEnd={() => setConfirmEnd(true)}
      onLeave={() => leave()}
    />
  );

  const overlays = (
    <>
      <RemotePointer
        ptr={remotePtr && remotePtr.panel !== "board-scene" ? remotePtr : null}
        editor={editorView}
        name={remote?.user.name ?? "Partner"}
        color={remoteColor}
      />
      <InviteDialog roomId={roomId} open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <EndConfirmDialog
        open={confirmEnd && !ended}
        onClose={() => setConfirmEnd(false)}
        onConfirm={() => endInterview("ended")}
        busy={ending}
        partnerName={partnerName}
      />
      {!ended && slot && <DeadlineWatcher expiresAt={expiresAt} onExpire={() => endInterview("expired")} />}
      {ended && (
        <WrapUpDialog
          roomId={roomId}
          ended={ended}
          role={role}
          partnerName={partnerName}
          problemSlug={session.problemSlug}
          shareNotes={shareNotes}
          onShareNotes={setShareNotes}
          onFinish={finish}
        />
      )}
    </>
  );

  const editorToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={session.language} onValueChange={(v) => isLanguageId(v) && changeLanguage(v)}>
        <SelectTrigger className="h-8 w-40 bg-secondary-background text-foreground shadow-shadow">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-100">
          {availableLanguages.map((l) => (
            <SelectItem key={l} value={l}>
              {LANGUAGES[l].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="neutral" className="h-8" onClick={resetCode} title="Replace the code with the starter">
        <RotateCcw /> {confirmReset ? "Sure?" : "Reset"}
      </Button>
      <Button
        size="sm"
        variant="neutral"
        className="h-8 bg-accent-green text-black"
        onClick={() => runCode("run")}
        disabled={busy || !slot}
        title="Run (⌘/Ctrl + Enter)"
      >
        {busy && run.runningMode !== "submit" ? <Spinner /> : <Play />} Run
      </Button>
      <Button
        size="sm"
        className="h-8"
        onClick={() => runCode("submit")}
        disabled={busy || !slot || !session.problemSlug}
        title="Submit against hidden tests (⌘/Ctrl + Shift + Enter)"
      >
        {busy && run.runningMode === "submit" ? <Spinner /> : <Send />} Submit
      </Button>
    </div>
  );

  const editorArea = (
    <section className="flex h-full min-h-0 flex-col rounded-base border-2 border-border bg-secondary-background shadow-lg">
      <Tabs
        className="bg-background"
        value={centerTab}
        onChange={setCenterTab}
        items={[
          { value: "code", label: "Code", icon: <Code2 /> },
          { value: "board", label: "Whiteboard", icon: <PenTool /> },
        ]}
        right={centerTab === "code" ? editorToolbar : undefined}
      />
      <div className="min-h-0 flex-1" data-pointer-panel={centerTab === "code" ? "editor" : "board"}>
        {centerTab === "code" ? (
          <CodeEditor
            ytext={ytext}
            awareness={awareness}
            language={session.language}
            readOnly={!slot || !!ended}
            onView={setEditorView}
          />
        ) : (
          <Whiteboard doc={doc} onPointer={sendBoardPointer} remotePointer={boardPtr} />
        )}
      </div>
    </section>
  );

  // System design: the whiteboard is the whole workspace.
  const boardArea = (
    <section className="flex h-full min-h-0 flex-col rounded-base border-2 border-border bg-secondary-background shadow-lg">
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-border bg-background px-3 py-2">
        <PenTool className="size-4" />
        <span className="font-heading">System design</span>
        <span className="text-xs text-muted">Whiteboard only. Sketch the architecture together.</span>
        <Button size="sm" variant="neutral" className="ml-auto h-8" onClick={() => setMode("coding")} disabled={!slot || !!ended}>
          <Code2 /> Switch to coding
        </Button>
      </div>
      <div className="min-h-0 flex-1" data-pointer-panel="board">
        <Whiteboard doc={doc} onPointer={sendBoardPointer} remotePointer={boardPtr} />
      </div>
    </section>
  );

  const output = (
    <div className="h-full" data-pointer-panel="output">
    <OutputPanel
      run={run}
      slot={slot}
      busy={busy}
      tab={outputTab}
      onTab={setOutputTab}
      stdin={stdin}
      onStdin={setStdin}
      hasProblem={!!session.problemSlug}
      runnerName={otherRunning ? remote?.user.name : user.displayName}
    />
    </div>
  );

  const problemPanel = (
    <div className="h-full" data-pointer-panel="problem">
    <ProblemPanel
      notes={notes}
      problem={problem}
      problems={problems}
      isInterviewer={isInterviewer}
      selectedSlug={session.problemSlug}
      onPick={pickProblem}
      remoteName={remote?.user.name ?? null}
    />
    </div>
  );

  const video = (
    <VideoPanel
      snap={snap}
      localTrack={localVideo}
      localName={user.displayName}
      localRole={role}
      remote={remote}
      remoteRole={remote && slot ? roleOf(remote.slot, session.interviewerSlot) : null}
      micOn={micOn}
      camOn={camOn}
      sharing={sharing}
      onMic={toggleMic}
      onCam={toggleCam}
      onShare={toggleShare}
      onLeave={() => leave()}
      onInvite={() => setInviteOpen(true)}
      compact={!wide}
    />
  );

  if (!wide) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        {header}
        <div className="space-y-3 p-3">
          {video}
          <div className="h-[50vh]">{problemPanel}</div>
          {mode === "design" ? (
            <div className="h-[75vh]">{boardArea}</div>
          ) : (
            <>
              <div className="h-[70vh]">{editorArea}</div>
              <div className="h-[50vh]">{output}</div>
            </>
          )}
        </div>
        {overlays}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background bg-dots">
      {header}
      <Group key={mode} orientation="horizontal" className="min-h-0 flex-1 p-3">
        <Panel defaultSize={mode === "design" ? "22%" : "27%"} minSize="14%">
          {problemPanel}
        </Panel>
        <ResizeHandle />
        <Panel defaultSize={mode === "design" ? "56%" : "51%"} minSize="30%">
          {mode === "design" ? (
            boardArea
          ) : (
          <Group orientation="vertical">
            <Panel defaultSize="66%" minSize="25%">
              {editorArea}
            </Panel>
            <ResizeHandle vertical />
            <Panel defaultSize="34%" minSize="12%">
              {output}
            </Panel>
          </Group>
          )}
        </Panel>
        <ResizeHandle />
        <Panel defaultSize="22%" minSize="16%" maxSize="40%">
          <div className="h-full" data-pointer-panel="video">
            {video}
          </div>
        </Panel>
      </Group>
      {overlays}
    </div>
  );
}

function ResizeHandle({ vertical = false }: { vertical?: boolean }) {
  return (
    <Separator
      className={cn(
        "group relative flex items-center justify-center",
        vertical ? "h-3 w-full cursor-row-resize" : "h-full w-3 cursor-col-resize",
      )}
    >
      <span
        className={cn(
          "grid place-items-center rounded-sm border-2 border-border bg-secondary-background text-foreground/60 transition-colors group-hover:bg-main group-hover:text-black group-data-[separator=active]:bg-main",
          vertical ? "h-3 w-10" : "h-10 w-3",
        )}
      >
        {vertical ? <GripHorizontal className="size-3" /> : <GripVertical className="size-3" />}
      </span>
    </Separator>
  );
}

function BlockingMessage({
  status,
  error,
  onLeave,
}: {
  status: "full" | "error";
  error: string | null;
  onLeave: () => void;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-grid p-4">
      <div className="max-w-md rounded-base border-4 border-border bg-secondary-background p-8 text-center shadow-xl">
        <div className="mx-auto grid size-16 place-items-center rounded-base border-2 border-border bg-accent-red text-3xl font-heading text-black">
          {status === "full" ? "2/2" : "!"}
        </div>
        <h1 className="mt-5 text-3xl">{status === "full" ? "This room is full" : "Couldn't connect"}</h1>
        <p className="mt-3 text-muted">
          {status === "full"
            ? "Rooms hold exactly two people, and both seats are taken. If you just refreshed, wait a few seconds and try again."
            : (error ?? "Something went wrong while connecting.")}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="neutral" onClick={() => window.location.reload()}>
            Try again
          </Button>
          <Button onClick={onLeave}>Go home</Button>
        </div>
      </div>
    </div>
  );
}

/** Warns before the room closes, then ends the interview when time runs out. Own component so the per-second tick doesn't re-render the room. */
function DeadlineWatcher({ expiresAt, onExpire }: { expiresAt: number; onExpire: () => void }) {
  const now = useNow(1_000);
  const leftMs = expiresAt - now;
  const warned = useRef<{ five: boolean; one: boolean }>({ five: false, one: false });
  const fired = useRef(false);
  useEffect(() => {
    if (leftMs <= ROOM_WARN_MS && leftMs > 60_000 && !warned.current.five) {
      warned.current.five = true;
      toast.warning("This room closes in 5 minutes. Extend it from the Room menu if you need more time.");
    }
    if (leftMs <= 60_000 && leftMs > 0 && !warned.current.one) {
      warned.current.one = true;
      toast.warning("This room closes in 1 minute.");
    }
    if (leftMs > ROOM_WARN_MS) warned.current = { five: false, one: false };
    if (leftMs <= 0 && !fired.current) {
      fired.current = true;
      // Deferred: ending updates state, which shouldn't happen synchronously in an effect.
      void Promise.resolve().then(onExpire);
    }
  }, [leftMs, onExpire]);
  return null;
}
