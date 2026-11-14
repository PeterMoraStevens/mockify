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
import { RoomConnection, type ConnSnapshot } from "@/lib/room/connection";
import { useMediaQuery, useRemotePresence, useY } from "@/lib/room/hooks";
import { blackVideoTrack, isSynthetic, stopStream } from "@/lib/room/media";
import {
  SLOT_COLORS,
  getCode,
  getRun,
  getSession,
  readRun,
  readSession,
  replaceCode,
  roleOf,
  type PresenceState,
  type RunState,
} from "@/lib/room/session-doc";
import type { RunMode, RunResponse } from "@/lib/run-types";
import { cn } from "@/lib/utils";
import { CodeEditor } from "./code-editor";
import { OutputPanel } from "./output-panel";
import { ProblemPanel } from "./problem-panel";
import type { JoinedState, RoomUser } from "./room";
import { RoomHeader } from "./room-header";
import { VideoPanel } from "./video-panel";

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

export type AnyProblem = PublicProblem | InterviewerProblem;

export function RoomView({
  roomId,
  user,
  joined,
  doc,
  awareness,
  onLeave,
}: {
  roomId: string;
  user: RoomUser;
  joined: JoinedState;
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

  const leave = () => {
    conn?.destroy();
    screenTrack.current?.stop();
    stopStream(joined.stream);
    onLeave();
    router.push("/");
  };

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
        getRun(doc).delete("last");
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
      getRun(doc).delete("last");
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

      let last: NonNullable<RunState["last"]>;
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
        r.set("last", last);
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

  // ---------------------------------------------------------------- layout
  const [centerTab, setCenterTab] = useState<"code" | "board">("code");
  const ytext = useMemo(() => getCode(doc), [doc]);

  if (snap.status === "full" || snap.status === "error") {
    return <BlockingMessage status={snap.status} error={snap.error} onLeave={leave} />;
  }

  const header = (
    <RoomHeader
      roomId={roomId}
      doc={doc}
      snap={snap}
      role={role}
      remote={remote}
      onSwap={swapRoles}
      onLeave={leave}
      feedback={
        isInterviewer && remote
          ? { roomId, candidateId: remote.userId, candidateName: remote.user.name, problemSlug: session.problemSlug }
          : null
      }
    />
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
      <div className="min-h-0 flex-1">
        {centerTab === "code" ? (
          <CodeEditor ytext={ytext} awareness={awareness} language={session.language} readOnly={!slot} />
        ) : (
          <Whiteboard doc={doc} />
        )}
      </div>
    </section>
  );

  const output = (
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
  );

  const problemPanel = (
    <ProblemPanel
      roomId={roomId}
      problem={problem}
      problems={problems}
      isInterviewer={isInterviewer}
      selectedSlug={session.problemSlug}
      onPick={pickProblem}
      remoteName={remote?.user.name ?? null}
    />
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
      onLeave={leave}
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
          <div className="h-[70vh]">{editorArea}</div>
          <div className="h-[50vh]">{output}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background bg-dots">
      {header}
      <Group orientation="horizontal" className="min-h-0 flex-1 p-3">
        <Panel defaultSize="27%" minSize="18%">
          {problemPanel}
        </Panel>
        <ResizeHandle />
        <Panel defaultSize="51%" minSize="30%">
          <Group orientation="vertical">
            <Panel defaultSize="66%" minSize="25%">
              {editorArea}
            </Panel>
            <ResizeHandle vertical />
            <Panel defaultSize="34%" minSize="12%">
              {output}
            </Panel>
          </Group>
        </Panel>
        <ResizeHandle />
        <Panel defaultSize="22%" minSize="16%" maxSize="40%">
          {video}
        </Panel>
      </Group>
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
