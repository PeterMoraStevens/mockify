import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Encode Uint8Array → base64 string for JSON transport
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Decode base64 string → Uint8Array
function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const EVENTS = {
  DOC_UPDATE: "yjs-doc-update",
  AWARENESS_UPDATE: "yjs-awareness-update",
  SYNC_REQUEST: "yjs-sync-request",
  SYNC_RESPONSE: "yjs-sync-response",
} as const;

export class SupabaseProvider {
  doc: Y.Doc;
  awareness: Awareness;
  private channel: RealtimeChannel;
  private synced = false;
  private destroyed = false;

  constructor(channel: RealtimeChannel, doc: Y.Doc) {
    this.doc = doc;
    this.channel = channel;
    this.awareness = new Awareness(doc);

    this.setupDocListener();
    this.setupAwarenessListener();
    this.setupChannelListeners();

    // Request initial sync from existing peers
    this.requestSync();
  }

  private setupDocListener() {
    // When the local doc changes, broadcast the update
    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === this || this.destroyed) return;
      this.channel.send({
        type: "broadcast",
        event: EVENTS.DOC_UPDATE,
        payload: { data: toBase64(update) },
      });
    });
  }

  private setupAwarenessListener() {
    this.awareness.on(
      "update",
      ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
        if (this.destroyed) return;
        const changedClients = [...added, ...updated, ...removed];
        const encodedUpdate = encodeAwarenessUpdate(this.awareness, changedClients);
        this.channel.send({
          type: "broadcast",
          event: EVENTS.AWARENESS_UPDATE,
          payload: { data: toBase64(encodedUpdate) },
        });
      }
    );
  }

  private setupChannelListeners() {
    // Receive doc updates from other peers
    this.channel.on("broadcast", { event: EVENTS.DOC_UPDATE }, (msg) => {
      if (this.destroyed) return;
      const update = fromBase64(msg.payload.data);
      Y.applyUpdate(this.doc, update, this);
    });

    // Receive awareness updates from other peers
    this.channel.on("broadcast", { event: EVENTS.AWARENESS_UPDATE }, (msg) => {
      if (this.destroyed) return;
      const update = fromBase64(msg.payload.data);
      applyAwarenessUpdate(this.awareness, update, this);
    });

    // When a new peer requests sync, respond with full doc state
    this.channel.on("broadcast", { event: EVENTS.SYNC_REQUEST }, () => {
      if (this.destroyed) return;
      const state = Y.encodeStateAsUpdate(this.doc);
      this.channel.send({
        type: "broadcast",
        event: EVENTS.SYNC_RESPONSE,
        payload: { data: toBase64(state) },
      });

      // Also send current awareness state so the new peer sees cursors
      const awarenessUpdate = encodeAwarenessUpdate(
        this.awareness,
        Array.from(this.awareness.getStates().keys())
      );
      this.channel.send({
        type: "broadcast",
        event: EVENTS.AWARENESS_UPDATE,
        payload: { data: toBase64(awarenessUpdate) },
      });
    });

    // Receive full doc state from a peer (initial sync)
    this.channel.on("broadcast", { event: EVENTS.SYNC_RESPONSE }, (msg) => {
      if (this.destroyed) return;
      const state = fromBase64(msg.payload.data);
      Y.applyUpdate(this.doc, state, this);
      this.synced = true;
    });
  }

  private requestSync() {
    // Small delay to ensure channel subscription is active before requesting
    setTimeout(() => {
      if (this.destroyed) return;
      this.channel.send({
        type: "broadcast",
        event: EVENTS.SYNC_REQUEST,
        payload: {},
      });
    }, 500);
  }

  get isSynced() {
    return this.synced;
  }

  destroy() {
    this.destroyed = true;
    removeAwarenessStates(this.awareness, [this.doc.clientID], this);
    this.awareness.destroy();
    this.doc.destroy();
  }
}
