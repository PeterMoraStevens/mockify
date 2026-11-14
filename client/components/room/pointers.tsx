"use client";

import type { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import type { Ephemeral, RoomConnection } from "@/lib/room/connection";

/**
 * Live mouse pointers. Each side sends where its pointer is *within a panel*
 * (marked with data-pointer-panel), as a fraction of that panel's box, so it
 * lands in the same place even though the two windows have different sizes
 * and layouts. Over the code it's anchored to a text position instead, so it
 * follows the code when the two editors are scrolled differently. The
 * whiteboard handles its own pointers in scene coordinates.
 */

type RemotePtr = Extract<Ephemeral, { k: "ptr"; panel: string }>;
const SEND_EVERY_MS = 40;

export function usePointerSync(conn: RoomConnection | null, editor: EditorView | null) {
  const [remote, setRemote] = useState<RemotePtr | null>(null);
  const editorRef = useRef(editor);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!conn) return;
    const off = conn.onEphemeral((m) => {
      if (m.k !== "ptr") return;
      setRemote(m.panel === null ? null : m);
    });

    let lastSent = 0;
    let lastPanel: string | null = null;
    let pending: number | null = null;
    let latest: PointerEvent | null = null;

    const send = () => {
      pending = null;
      const e = latest;
      if (!e) return;
      lastSent = performance.now();
      const el = (e.target as Element | null)?.closest?.("[data-pointer-panel]") as HTMLElement | null;
      const panel = el?.dataset.pointerPanel ?? null;
      if (!el || !panel || panel === "board") {
        if (lastPanel !== null) conn.sendEphemeral({ k: "ptr", panel: null });
        lastPanel = null;
        return;
      }
      lastPanel = panel;
      const r = el.getBoundingClientRect();
      const msg: RemotePtr = { k: "ptr", panel, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      const view = editorRef.current;
      if (panel === "editor" && view) {
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY }, false);
        const at = view.coordsAtPos(pos);
        if (at) {
          msg.pos = pos;
          msg.dx = Math.round(e.clientX - at.left);
          msg.dy = Math.round(e.clientY - at.top);
        }
      }
      conn.sendEphemeral(msg);
    };

    const onMove = (e: PointerEvent) => {
      latest = e;
      if (pending !== null) return;
      const wait = Math.max(0, SEND_EVERY_MS - (performance.now() - lastSent));
      pending = window.setTimeout(send, wait);
    };
    const onLeave = () => {
      latest = null;
      if (lastPanel !== null) conn.sendEphemeral({ k: "ptr", panel: null });
      lastPanel = null;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      off();
      if (pending !== null) window.clearTimeout(pending);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [conn]);

  return remote;
}

/** Draws the other person's pointer on top of the page. */
export function RemotePointer({
  ptr,
  editor,
  name,
  color,
}: {
  ptr: RemotePtr | null;
  editor: EditorView | null;
  name: string;
  color: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [labelOn, setLabelOn] = useState(true);

  // Name label fades a few seconds after the pointer stops moving.
  useEffect(() => {
    if (!ptr) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- driven by incoming network messages
    setLabelOn(true);
    const t = window.setTimeout(() => setLabelOn(false), 3000);
    return () => window.clearTimeout(t);
  }, [ptr]);

  // Re-place every frame so it tracks scrolling and resizing on our side.
  useEffect(() => {
    if (!ptr) return;
    let raf = 0;
    const place = () => {
      raf = requestAnimationFrame(place);
      const node = ref.current;
      if (!node) return;
      const el = document.querySelector<HTMLElement>(`[data-pointer-panel="${ptr.panel}"]`);
      if (!el || el.offsetParent === null) {
        node.style.opacity = "0";
        return;
      }
      const r = el.getBoundingClientRect();
      let x = r.left + ptr.x * r.width;
      let y = r.top + ptr.y * r.height;
      if (ptr.panel === "editor" && editor && ptr.pos !== undefined && ptr.pos <= editor.state.doc.length) {
        const at = editor.coordsAtPos(ptr.pos);
        if (at) {
          x = at.left + (ptr.dx ?? 0);
          y = at.top + (ptr.dy ?? 0);
        }
      }
      const inside = x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2;
      node.style.opacity = inside ? "1" : "0";
      node.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, [ptr, editor]);

  if (!ptr) return null;
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-150 transition-[transform] duration-75 ease-linear"
      style={{ opacity: 0 }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" className="drop-shadow-[1px_1px_0_rgba(0,0,0,0.6)]">
        <path d="M2 1.5 L15.5 8.2 L9.3 9.6 L6.4 15.6 Z" fill={color} stroke="#000" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <span
        className="absolute left-4 top-4 whitespace-nowrap rounded-[3px] border-[1.5px] border-black px-1.5 py-px font-sans text-[11px] font-bold leading-tight text-black transition-opacity duration-300"
        style={{ background: color, opacity: labelOn ? 1 : 0 }}
      >
        {name}
      </span>
    </div>
  );
}
