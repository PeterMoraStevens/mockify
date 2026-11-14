"use client";

import "@excalidraw/excalidraw/index.css";
import { CaptureUpdateAction, Excalidraw, reconcileElements } from "@excalidraw/excalidraw";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { Collaborator, ExcalidrawImperativeAPI, SocketId } from "@excalidraw/excalidraw/types";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import type * as Y from "yjs";
import { getWhiteboard } from "@/lib/room/session-doc";

const LOCAL = Symbol("wb-local");
const FLUSH_MS = 50;

type El = OrderedExcalidrawElement;

/**
 * Excalidraw synced through a Y.Map keyed by element id. Each side only
 * writes elements whose version went up, and remote changes are merged with
 * Excalidraw's own reconcileElements (version + versionNonce), so there are
 * no echo loops and concurrent edits settle the same way on both sides.
 */
export type BoardPointer = { x: number; y: number; name: string; color: string };

export default function Whiteboard({
  doc,
  onPointer,
  remotePointer,
}: {
  doc: Y.Doc;
  /** Local pointer in scene coordinates (so it lands right whatever the other person's zoom/scroll). */
  onPointer?: (p: { x: number; y: number } | null) => void;
  remotePointer?: BoardPointer | null;
}) {
  const { resolvedTheme } = useTheme();
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const pending = useRef<Map<string, El>>(new Map());
  const flushTimer = useRef<number | null>(null);
  const wb = getWhiteboard(doc);

  // Initial scene from the doc.
  const initialElements = useRef<El[] | null>(null);
  if (initialElements.current === null) {
    initialElements.current = [...wb.values()] as unknown as El[];
  }

  useEffect(() => {
    if (!api) return;
    const onRemote = (_e: Y.YMapEvent<Record<string, unknown>>, tx: Y.Transaction) => {
      if (tx.origin === LOCAL) return;
      const remote = [...wb.values()] as unknown as El[];
      const merged = reconcileElements(
        api.getSceneElementsIncludingDeleted(),
        remote as unknown as Parameters<typeof reconcileElements>[1],
        api.getAppState(),
      );
      api.updateScene({ elements: merged, captureUpdate: CaptureUpdateAction.NEVER });
    };
    wb.observe(onRemote);
    return () => wb.unobserve(onRemote);
  }, [api, wb]);

  // The other person's pointer, drawn by Excalidraw itself as a collaborator.
  useEffect(() => {
    if (!api) return;
    const collaborators = new Map<SocketId, Collaborator>();
    if (remotePointer) {
      collaborators.set("remote" as SocketId, {
        username: remotePointer.name,
        color: { background: remotePointer.color, stroke: remotePointer.color },
        pointer: { x: remotePointer.x, y: remotePointer.y, tool: "pointer" },
      });
    }
    api.updateScene({ collaborators, captureUpdate: CaptureUpdateAction.NEVER });
  }, [api, remotePointer]);

  const flush = () => {
    flushTimer.current = null;
    const batch = [...pending.current.values()];
    pending.current.clear();
    if (!batch.length) return;
    doc.transact(() => {
      for (const el of batch) wb.set(el.id, JSON.parse(JSON.stringify(el)));
    }, LOCAL);
  };

  const onChange = (elements: readonly El[]) => {
    for (const el of elements) {
      const prev = wb.get(el.id) as { version: number; versionNonce: number } | undefined;
      // Same tie-break as reconcileElements: higher version wins, then lower nonce.
      const newer =
        !prev || prev.version < el.version || (prev.version === el.version && el.versionNonce < prev.versionNonce);
      if (newer) pending.current.set(el.id, el);
    }
    if (pending.current.size && flushTimer.current === null) {
      flushTimer.current = window.setTimeout(flush, FLUSH_MS);
    }
  };

  useEffect(
    () => () => {
      if (flushTimer.current !== null) {
        window.clearTimeout(flushTimer.current);
        flush();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="excalidraw-host h-full w-full" onPointerLeave={() => onPointer?.(null)}>
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={{ elements: initialElements.current, scrollToContent: true }}
        onChange={onChange}
        onPointerUpdate={(p) => onPointer?.({ x: p.pointer.x, y: p.pointer.y })}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        UIOptions={{
          tools: { image: false },
          canvasActions: { loadScene: false, saveToActiveFile: false, export: { saveFileToDisk: true } },
        }}
      />
    </div>
  );
}
