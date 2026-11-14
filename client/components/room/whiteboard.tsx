"use client";

import "@excalidraw/excalidraw/index.css";
import { CaptureUpdateAction, Excalidraw, reconcileElements } from "@excalidraw/excalidraw";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
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
export default function Whiteboard({ doc }: { doc: Y.Doc }) {
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
    <div className="excalidraw-host h-full w-full">
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={{ elements: initialElements.current, scrollToContent: true }}
        onChange={onChange}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        UIOptions={{
          tools: { image: false },
          canvasActions: { loadScene: false, saveToActiveFile: false, export: { saveFileToDisk: true } },
        }}
      />
    </div>
  );
}
