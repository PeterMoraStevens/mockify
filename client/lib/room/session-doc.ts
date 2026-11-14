"use client";

import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import type { LanguageId } from "@/lib/languages";
import type { RunMode, RunResponse } from "@/lib/run-types";

/**
 * Everything the two people share lives in one Y.Doc that syncs directly
 * between browsers over the WebRTC data channel. The server never sees it.
 *
 *   code      Y.Text   the editor
 *   session   Y.Map    problem slug, language, which slot is interviewing
 *   timer     Y.Map    shared countdown
 *   run       Y.Map    latest test run and latest custom run (kept separately) + who is running
 *   wb        Y.Map    whiteboard elements keyed by element id
 *   notes     Y.Map    notes people chose to share, keyed by user id
 *
 * Both browsers also save the doc to the server every so often, so a room can
 * be rejoined later and the interview summary has the code and whiteboard.
 */

export type Slot = "a" | "b";
export type Role = "interviewer" | "candidate";

export type TimerState = {
  durationMs: number;
  running: boolean;
  /** Remaining when paused / not started. */
  remainingMs: number;
  /** Author clock end time when running. */
  endsAt: number | null;
  /** Whose clock endsAt is measured on. */
  author: Slot | null;
};

export type RunResult = RunResponse & { by: Slot; byName: string; at: number; language: LanguageId; error?: string };

export type RunState = {
  runningBy: Slot | null;
  runningMode: RunMode | null;
  /** Latest Run/Submit against the problem's tests. */
  tests: RunResult | null;
  /** Latest run with custom stdin. Kept separately so neither wipes the other. */
  custom: RunResult | null;
};

export type SharedNote = { name: string; text: string; at: number };

/** Set when someone ends the interview; both browsers then show the wrap-up. */
export type EndedState = { by: Slot; byName: string; at: number; reason: "ended" | "expired" };

export type PresenceState = {
  user: { name: string; color: string; colorLight: string };
  userId: string;
  slot: Slot;
  muted: boolean;
  cameraOff: boolean;
  sharing: boolean;
};

export const SLOT_COLORS: Record<Slot, { color: string; colorLight: string }> = {
  a: { color: "#ff7a05", colorLight: "#ff7a0533" },
  b: { color: "#0099ff", colorLight: "#0099ff33" },
};

export const DEFAULT_DURATION_MS = 45 * 60 * 1000;

export function createSessionDoc() {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  return { doc, awareness };
}

export const getCode = (doc: Y.Doc) => doc.getText("code");
export const getSession = (doc: Y.Doc) => doc.getMap<unknown>("session");
export const getTimer = (doc: Y.Doc) => doc.getMap<unknown>("timer");
export const getRun = (doc: Y.Doc) => doc.getMap<unknown>("run");
export const getWhiteboard = (doc: Y.Doc) => doc.getMap<Record<string, unknown>>("wb");
export const getSharedNotes = (doc: Y.Doc) => doc.getMap<SharedNote>("notes");

export function readSession(doc: Y.Doc) {
  const s = getSession(doc);
  return {
    problemSlug: (s.get("problemSlug") as string | undefined) ?? null,
    language: ((s.get("language") as LanguageId | undefined) ?? "python") as LanguageId,
    interviewerSlot: ((s.get("interviewerSlot") as Slot | undefined) ?? "a") as Slot,
    ended: (s.get("ended") as EndedState | undefined) ?? null,
    /** Room deadline after an extension, so the other person sees it immediately. */
    expiresAt: (s.get("expiresAt") as number | undefined) ?? null,
  };
}

export function readTimer(doc: Y.Doc): TimerState {
  const t = getTimer(doc);
  const durationMs = (t.get("durationMs") as number | undefined) ?? DEFAULT_DURATION_MS;
  return {
    durationMs,
    running: (t.get("running") as boolean | undefined) ?? false,
    remainingMs: (t.get("remainingMs") as number | undefined) ?? durationMs,
    endsAt: (t.get("endsAt") as number | undefined) ?? null,
    author: (t.get("author") as Slot | undefined) ?? null,
  };
}

export function readRun(doc: Y.Doc): RunState {
  const r = getRun(doc);
  return {
    runningBy: (r.get("runningBy") as Slot | undefined) ?? null,
    runningMode: (r.get("runningMode") as RunMode | undefined) ?? null,
    tests: (r.get("tests") as RunResult | undefined) ?? null,
    custom: (r.get("custom") as RunResult | undefined) ?? null,
  };
}

export const roleOf = (slot: Slot, interviewerSlot: Slot): Role =>
  slot === interviewerSlot ? "interviewer" : "candidate";

export const otherSlot = (s: Slot): Slot => (s === "a" ? "b" : "a");

/** Replace the editor contents in one transaction (problem pick, language switch, reset). */
export function replaceCode(doc: Y.Doc, text: string, origin?: unknown) {
  const code = getCode(doc);
  doc.transact(() => {
    code.delete(0, code.length);
    code.insert(0, text);
  }, origin);
}

// ---------------------------------------------------------- persistence
// A refresh shouldn't lose the session. We store the doc's own update log,
// so merging it with the peer's copy later is idempotent (no duplicated code).

const storageKey = (roomId: string) => `mockify:room:${roomId}:doc`;

export function loadPersisted(doc: Y.Doc, roomId: string) {
  try {
    const raw = localStorage.getItem(storageKey(roomId));
    if (!raw) return;
    const bin = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    Y.applyUpdate(doc, bin, "persistence");
  } catch {
    /* storage blocked or corrupt; start fresh */
  }
}

export function persistOnChange(doc: Y.Doc, roomId: string): () => void {
  let timer: number | null = null;
  const save = () => {
    timer = null;
    try {
      const bin = Y.encodeStateAsUpdate(doc);
      let s = "";
      for (let i = 0; i < bin.length; i += 0x8000) {
        s += String.fromCharCode(...bin.subarray(i, i + 0x8000));
      }
      localStorage.setItem(storageKey(roomId), btoa(s));
    } catch {
      /* quota or blocked storage */
    }
  };
  const onUpdate = () => {
    if (timer === null) timer = window.setTimeout(save, 800);
  };
  doc.on("update", onUpdate);
  return () => {
    doc.off("update", onUpdate);
    if (timer !== null) {
      window.clearTimeout(timer);
      save();
    }
  };
}

export function encodeDoc(doc: Y.Doc): string {
  const bin = Y.encodeStateAsUpdate(doc);
  let out = "";
  for (let i = 0; i < bin.length; i += 0x8000) out += String.fromCharCode(...bin.subarray(i, i + 0x8000));
  return btoa(out);
}

export function applyEncoded(doc: Y.Doc, b64: string, origin: unknown = "server") {
  try {
    Y.applyUpdate(doc, Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), origin);
  } catch {
    /* corrupt; ignore */
  }
}
