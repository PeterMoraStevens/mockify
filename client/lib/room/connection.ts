"use client";

import type { DataConnection, MediaConnection, Peer as PeerType, PeerOptions } from "peerjs";
import * as Y from "yjs";
import {
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
  type Awareness,
} from "y-protocols/awareness";
import type { Slot } from "./session-doc";

/**
 * Two-person room over PeerJS.
 *
 *   1. Try to register PeerJS id `mockify-<room>-a`. If it's taken, take `-b`.
 *      Both taken → the room is full.
 *   2. b dials a (data + media). a just answers. If the link drops, b keeps
 *      redialling, so either side can refresh and the call heals itself.
 *   3. The Yjs doc and awareness sync over the data channel. Media goes over
 *      its own call. WebRTC goes direct when it can and falls back to TURN.
 */

export type ConnStatus =
  | "init"
  | "signaling"
  | "waiting"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "full"
  | "error";

export type PathType = "direct" | "relayed";

export type ConnSnapshot = {
  status: ConnStatus;
  slot: Slot | null;
  error: string | null;
  remoteStream: MediaStream | null;
  path: PathType | null;
  rttMs: number | null;
  /** remoteClock - localClock, estimated from pings. */
  clockOffsetMs: number;
};

export type RoomConfig = {
  roomId: string;
  iceServers: RTCIceServer[];
  peer: { host: string; port: number; path: string; secure: boolean; key: string };
};

type Msg =
  | { t: "sv"; d: Uint8Array | ArrayBuffer }
  | { t: "up"; d: Uint8Array | ArrayBuffer }
  | { t: "aw"; d: Uint8Array | ArrayBuffer }
  | { t: "ping"; ts: number }
  | { t: "pong"; ts: number; now: number }
  | { t: "eph"; d: Ephemeral }
  | { t: "bye" };

/** Fire-and-forget state that isn't worth keeping in the doc (live pointers). */
export type Ephemeral =
  | { k: "ptr"; panel: string; x: number; y: number; pos?: number; dx?: number; dy?: number }
  | { k: "ptr"; panel: null };

const REMOTE = Symbol("remote");
const HEARTBEAT_MS = 2000;
const DEAD_AFTER_MS = 9000;
const REDIAL_MS = 2500;
const CLAIM_ATTEMPTS = 6;

const toBytes = (d: Uint8Array | ArrayBuffer) => (d instanceof Uint8Array ? d : new Uint8Array(d));

export class RoomConnection {
  private snap: ConnSnapshot = {
    status: "init",
    slot: null,
    error: null,
    remoteStream: null,
    path: null,
    rttMs: null,
    clockOffsetMs: 0,
  };
  private listeners = new Set<() => void>();
  private peer: PeerType | null = null;
  private dc: DataConnection | null = null;
  private call: MediaConnection | null = null;
  private destroyed = false;
  private lastHeard = 0;
  private timers: number[] = [];
  private redialTimer: number | null = null;
  private remoteAwarenessClients = new Set<number>();
  private rttSamples: number[] = [];
  private ephemeralListeners = new Set<(m: Ephemeral) => void>();
  private offsetSamples: number[] = [];

  constructor(
    private cfg: RoomConfig,
    private doc: Y.Doc,
    private awareness: Awareness,
    private localStream: MediaStream,
  ) {
    this.doc.on("update", this.onDocUpdate);
    this.awareness.on("update", this.onAwarenessUpdate);
  }

  // ------------------------------------------------------------ store API

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snap;
  private set(patch: Partial<ConnSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l();
  }

  private peerId(slot: Slot) {
    return `mockify-${this.cfg.roomId}-${slot}`;
  }

  // ------------------------------------------------------------ lifecycle

  async start() {
    this.set({ status: "signaling" });
    const { Peer } = await import("peerjs");
    if (this.destroyed) return;

    const opts: PeerOptions = {
      host: this.cfg.peer.host,
      port: this.cfg.peer.port,
      path: this.cfg.peer.path,
      secure: this.cfg.peer.secure,
      key: this.cfg.peer.key,
      config: { iceServers: this.cfg.iceServers },
      debug: 1,
    };

    // A refreshed tab's old id can linger on the signaling server for a few
    // seconds, so "both taken" gets a few retries before we call it full.
    for (let attempt = 0; attempt < CLAIM_ATTEMPTS && !this.destroyed; attempt++) {
      for (const slot of ["a", "b"] as const) {
        const result = await this.tryOpen(Peer, slot, opts);
        if (this.destroyed) {
          result.peer?.destroy();
          return;
        }
        if (result.peer) {
          this.peer = result.peer;
          this.set({ slot, status: "waiting", error: null });
          this.wirePeer(slot);
          this.timers.push(window.setInterval(this.heartbeat, HEARTBEAT_MS));
          this.timers.push(window.setInterval(this.pollStats, 3000));
          if (slot === "b") this.dial();
          return;
        }
        if (result.error !== "unavailable-id") {
          this.set({ status: "error", error: result.message });
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 1500 + attempt * 500));
    }
    if (!this.destroyed) this.set({ status: "full" });
  }

  private tryOpen(
    Peer: typeof import("peerjs").Peer,
    slot: Slot,
    opts: PeerOptions,
  ): Promise<{ peer: PeerType | null; error?: string; message?: string }> {
    return new Promise((resolve) => {
      const p = new Peer(this.peerId(slot), opts);
      const onOpen = () => {
        p.off("error", onError);
        resolve({ peer: p });
      };
      const onError = (err: { type: string; message: string }) => {
        p.off("open", onOpen);
        p.destroy();
        const message =
          err.type === "network" || err.type === "server-error" || err.type === "socket-error"
            ? "Can't reach the signaling server. Is the PeerJS server running?"
            : err.message;
        resolve({ peer: null, error: err.type, message });
      };
      p.once("open", onOpen);
      p.once("error", onError);
    });
  }

  private wirePeer(slot: Slot) {
    const peer = this.peer!;

    peer.on("connection", (dc) => this.adoptData(dc, true));
    peer.on("call", (call) => {
      call.answer(this.localStream);
      this.adoptCall(call);
    });

    peer.on("error", (err) => {
      if (err.type === "peer-unavailable") {
        // b dialled a, but a isn't there (yet). Keep trying quietly.
        if (slot === "b") this.scheduleRedial();
        return;
      }
      if (err.type === "network" || err.type === "server-error" || err.type === "socket-error") {
        // Signaling hiccup. The P2P link (if any) keeps working.
        return;
      }
      console.warn("[peer]", err.type, err.message);
    });

    // Lost the signaling socket (not the call). Reconnect so the other side
    // can find us again after a refresh.
    peer.on("disconnected", () => {
      if (this.destroyed) return;
      window.setTimeout(() => {
        if (!this.destroyed && this.peer?.disconnected) this.peer.reconnect();
      }, 1000);
    });
  }

  private lostAt = 0;

  private dial = () => {
    this.redialTimer = null;
    if (this.destroyed || !this.peer || this.snap.slot !== "b") return;
    if (this.dc?.open) return;
    // After a while without them, stop saying "reconnecting": they've probably left.
    if (this.snap.status === "reconnecting" && Date.now() - this.lostAt > 15_000) this.set({ status: "waiting" });

    const target = this.peerId("a");
    const dc = this.peer.connect(target, { reliable: true, serialization: "binary" });
    this.adoptData(dc, false);
    const call = this.peer.call(target, this.localStream);
    if (call) this.adoptCall(call);
    // If the data channel doesn't open soon, try again.
    this.scheduleRedial(REDIAL_MS * 3);
  };

  private scheduleRedial(ms = REDIAL_MS) {
    if (this.destroyed || this.snap.slot !== "b") return;
    if (this.redialTimer !== null) window.clearTimeout(this.redialTimer);
    this.redialTimer = window.setTimeout(this.dial, ms);
  }

  // ---------------------------------------------------------- data channel

  /**
   * `incoming` means the other person dialled us, so they're really there.
   * b's own outgoing dials don't count: a may simply not have arrived yet,
   * and showing "Connecting…" while nobody is coming is misleading.
   */
  private adoptData(dc: DataConnection, incoming: boolean) {
    // Newest connection wins (the other side refreshed).
    if (this.dc && this.dc !== dc) {
      const old = this.dc;
      this.dc = null;
      old.close();
    }
    this.dc = dc;
    if (incoming && this.snap.status !== "connected") this.set({ status: "connecting" });

    dc.on("open", () => {
      if (this.dc !== dc) return;
      if (this.redialTimer !== null) {
        window.clearTimeout(this.redialTimer);
        this.redialTimer = null;
      }
      this.lastHeard = Date.now();
      this.rttSamples = [];
      this.offsetSamples = [];
      this.set({ status: "connected", error: null });
      // Yjs sync step 1: tell them what we have; they reply with what we lack.
      this.send({ t: "sv", d: Y.encodeStateVector(this.doc) });
      this.send({
        t: "aw",
        d: encodeAwarenessUpdate(this.awareness, [this.awareness.clientID]),
      });
      this.send({ t: "ping", ts: performance.now() });
    });

    dc.on("data", (raw) => this.onMessage(raw as Msg));
    dc.on("close", () => this.onLinkLost(dc));
    dc.on("error", () => this.onLinkLost(dc));
  }

  private onMessage(m: Msg) {
    this.lastHeard = Date.now();
    switch (m.t) {
      case "sv":
        this.send({ t: "up", d: Y.encodeStateAsUpdate(this.doc, toBytes(m.d)) });
        break;
      case "up":
        Y.applyUpdate(this.doc, toBytes(m.d), REMOTE);
        break;
      case "aw": {
        const bytes = toBytes(m.d);
        const before = new Set(this.awareness.getStates().keys());
        applyAwarenessUpdate(this.awareness, bytes, REMOTE);
        for (const id of this.awareness.getStates().keys()) {
          if (!before.has(id) && id !== this.awareness.clientID) this.remoteAwarenessClients.add(id);
        }
        break;
      }
      case "ping":
        this.send({ t: "pong", ts: m.ts, now: Date.now() });
        break;
      case "pong": {
        const rtt = performance.now() - m.ts;
        this.rttSamples = [...this.rttSamples.slice(-4), rtt];
        this.offsetSamples = [...this.offsetSamples.slice(-9), m.now + rtt / 2 - Date.now()];
        const sorted = [...this.offsetSamples].sort((a, b) => a - b);
        const avgRtt = this.rttSamples.reduce((a, b) => a + b, 0) / this.rttSamples.length;
        this.set({ rttMs: Math.round(avgRtt), clockOffsetMs: Math.round(sorted[Math.floor(sorted.length / 2)]) });
        break;
      }
      case "eph":
        for (const l of this.ephemeralListeners) l(m.d);
        break;
      case "bye":
        // They left on purpose: we're alone, not reconnecting.
        this.onLinkLost(this.dc, true);
        break;
    }
  }

  private send(m: Msg) {
    const dc = this.dc;
    if (!dc?.open) return;
    try {
      dc.send(m);
    } catch (e) {
      console.warn("[dc] send failed", e);
    }
  }

  /** Unreliable-in-spirit extras (we still use the reliable channel; they're tiny). */
  sendEphemeral(d: Ephemeral) {
    this.send({ t: "eph", d });
  }

  onEphemeral(fn: (m: Ephemeral) => void) {
    this.ephemeralListeners.add(fn);
    return () => {
      this.ephemeralListeners.delete(fn);
    };
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE) return;
    this.send({ t: "up", d: update });
  };

  private onAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === REMOTE) return;
    const changed = [...added, ...updated, ...removed].filter((id) => id === this.awareness.clientID);
    if (changed.length) this.send({ t: "aw", d: encodeAwarenessUpdate(this.awareness, changed) });
  };

  private heartbeat = () => {
    if (!this.dc?.open) return;
    if (Date.now() - this.lastHeard > DEAD_AFTER_MS) {
      this.onLinkLost(this.dc);
      return;
    }
    this.send({ t: "ping", ts: performance.now() });
  };

  private onLinkLost(dc: DataConnection | null, graceful = false) {
    if (this.destroyed || !dc || this.dc !== dc) return;
    this.dc = null;
    this.lostAt = Date.now();
    try {
      dc.close();
    } catch {}
    this.call?.close();
    this.call = null;
    if (this.remoteAwarenessClients.size) {
      removeAwarenessStates(this.awareness, [...this.remoteAwarenessClients], REMOTE);
      this.remoteAwarenessClients.clear();
    }
    this.set({
      status: this.snap.slot === "b" && !graceful ? "reconnecting" : "waiting",
      remoteStream: null,
      path: null,
      rttMs: null,
    });
    if (this.snap.slot === "b") this.scheduleRedial(500);
  }

  // ----------------------------------------------------------------- media

  private adoptCall(call: MediaConnection) {
    if (this.call && this.call !== call) this.call.close();
    this.call = call;
    call.on("stream", (stream) => {
      if (this.call === call) this.set({ remoteStream: stream });
    });
    call.on("close", () => {
      if (this.call === call) {
        this.call = null;
        this.set({ remoteStream: null });
      }
    });
    call.on("error", (e) => console.warn("[call]", e));
  }

  /** Swap the outgoing camera/screen/mic track without renegotiating. */
  async replaceTrack(kind: "audio" | "video", track: MediaStreamTrack) {
    const old = this.localStream.getTracks().find((t) => t.kind === kind);
    if (old && old !== track) {
      this.localStream.removeTrack(old);
    }
    if (!this.localStream.getTracks().includes(track)) this.localStream.addTrack(track);
    const sender = this.call?.peerConnection?.getSenders().find((s) => s.track?.kind === kind);
    if (sender) await sender.replaceTrack(track);
    return old;
  }

  private pollStats = async () => {
    const pc = this.call?.peerConnection ?? this.dc?.peerConnection;
    if (!pc) return;
    try {
      const stats = await pc.getStats();
      let pair: RTCIceCandidatePairStats | undefined;
      stats.forEach((r) => {
        if (r.type === "transport" && r.selectedCandidatePairId) {
          pair = stats.get(r.selectedCandidatePairId);
        }
      });
      if (!pair) {
        stats.forEach((r) => {
          if (r.type === "candidate-pair" && r.state === "succeeded" && (r.nominated || r.selected)) pair = r;
        });
      }
      if (!pair) return;
      const local = stats.get(pair.localCandidateId);
      const remote = stats.get(pair.remoteCandidateId);
      const relayed = local?.candidateType === "relay" || remote?.candidateType === "relay";
      const patch: Partial<ConnSnapshot> = { path: relayed ? "relayed" : "direct" };
      if (typeof pair.currentRoundTripTime === "number" && this.snap.rttMs === null) {
        patch.rttMs = Math.round(pair.currentRoundTripTime * 1000);
      }
      if (patch.path !== this.snap.path || patch.rttMs !== undefined) this.set(patch);
    } catch {
      /* stats are best-effort */
    }
  };

  destroy() {
    if (this.destroyed) return;
    this.send({ t: "bye" });
    this.destroyed = true;
    this.doc.off("update", this.onDocUpdate);
    this.awareness.off("update", this.onAwarenessUpdate);
    for (const t of this.timers) window.clearInterval(t);
    if (this.redialTimer !== null) window.clearTimeout(this.redialTimer);
    this.call?.close();
    this.dc?.close();
    this.peer?.destroy();
    this.listeners.clear();
    this.ephemeralListeners.clear();
  }
}
