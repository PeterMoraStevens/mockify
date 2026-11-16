"use client";

import type { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import type { Ephemeral, RoomConnection } from "@/lib/room/connection";

/**
 * Live mouse pointers, anchored to *content* rather than screen position, so
 * the pointer shows what the other person is actually looking at even though
 * the two windows differ in size, layout and scroll position:
 *
 *  - over text (problem statement, output, notes…): the exact character, found
 *    again on our side by the text node's position and contents;
 *  - over the code: the document position (CodeMirror coordinates);
 *  - over any other element (buttons, video tiles…): the same element, by its
 *    path from the panel root, and the same spot within it;
 *  - otherwise: the same fraction of the panel.
 *
 * Panels are marked with data-pointer-panel. If the anchored content is
 * scrolled out of view on our side, the pointer is hidden rather than drawn
 * somewhere misleading. The whiteboard handles its own pointers in scene
 * coordinates.
 */

type RemotePtr = Extract<Ephemeral, { k: "ptr"; panel: string }>;
const SEND_EVERY_MS = 40;
const SNIP = 32;

// ------------------------------------------------------------- text nodes

function textNodes(root: Element): Text[] {
  const out: Text[] = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  for (let n = w.nextNode(); n; n = w.nextNode()) out.push(n as Text);
  return out;
}

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const d = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  const r = d.caretRangeFromPoint?.(x, y);
  return r ? { node: r.startContainer, offset: r.startOffset } : null;
}

/** The box of one character, or null if it has no layout. */
function charRect(node: Text, off: number): DOMRect | null {
  const len = node.length;
  if (!len) return null;
  const i = Math.max(0, Math.min(off, len - 1));
  const range = document.createRange();
  range.setStart(node, i);
  range.setEnd(node, i + 1);
  const rects = range.getClientRects();
  const r = rects[0] ?? range.getBoundingClientRect();
  return r && (r.width || r.height) ? r : null;
}

const snippet = (t: Text) => (t.nodeValue ?? "").trim().slice(0, SNIP);

/** Which character (if any) is under the point. Only counts if the point is really on that text, not beside it. */
function textAnchor(panel: Element, x: number, y: number): RemotePtr["text"] | undefined {
  const c = caretAt(x, y);
  if (!c || c.node.nodeType !== Node.TEXT_NODE || !panel.contains(c.node)) return;
  const node = c.node as Text;
  if (!node.nodeValue?.trim()) return;
  // The caret sits between characters: pick whichever neighbour contains the point.
  let off = c.offset;
  let r = charRect(node, off);
  if (!r || x < r.left - 1) {
    off = Math.max(0, off - 1);
    r = charRect(node, off);
  }
  if (!r) return;
  // Far from the glyph (blank space next to a short line, padding): not over the text.
  if (x < r.left - 4 || x > r.right + 4 || y < r.top - 4 || y > r.bottom + 4) return;
  const all = textNodes(panel);
  const i = all.indexOf(node);
  if (i < 0) return;
  return { i, snip: snippet(node), off, dx: Math.round(x - r.left), dy: Math.round(y - r.top) };
}

/** Finds the same text node on our side: same index if its text matches, else the nearest node with that text. */
function findText(panel: Element, a: NonNullable<RemotePtr["text"]>): Text | null {
  const all = textNodes(panel);
  if (all[a.i] && snippet(all[a.i]) === a.snip) return all[a.i];
  let best: Text | null = null;
  let bestDist = Infinity;
  all.forEach((n, i) => {
    if (snippet(n) === a.snip && Math.abs(i - a.i) < bestDist) {
      best = n;
      bestDist = Math.abs(i - a.i);
    }
  });
  return best;
}

// --------------------------------------------------------------- elements

function elementAnchor(panel: Element, target: Element, x: number, y: number): RemotePtr["el"] | undefined {
  const path: number[] = [];
  let el: Element | null = target;
  while (el && el !== panel) {
    const parent: Element | null = el.parentElement;
    if (!parent) return;
    path.unshift(Array.prototype.indexOf.call(parent.children, el));
    el = parent;
  }
  if (el !== panel || path.length > 40) return;
  const r = target.getBoundingClientRect();
  if (!r.width || !r.height) return;
  return { path, tag: target.tagName, fx: (x - r.left) / r.width, fy: (y - r.top) / r.height };
}

function findElement(panel: Element, a: NonNullable<RemotePtr["el"]>): Element | null {
  let el: Element | null = panel;
  for (const i of a.path) {
    el = el?.children[i] ?? null;
    if (!el) return null;
  }
  return el && el.tagName === a.tag ? el : null;
}

/** Is the point inside every clipping (scrolling) ancestor up to the panel? */
function visibleWithin(node: Node, panel: Element, x: number, y: number): boolean {
  for (let el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement; el; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (el === panel || style.overflowX !== "visible" || style.overflowY !== "visible") {
      const r = el.getBoundingClientRect();
      if (x < r.left - 2 || x > r.right + 2 || y < r.top - 2 || y > r.bottom + 2) return false;
    }
    if (el === panel) return true;
  }
  return true;
}

// ------------------------------------------------------------------ hooks

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
      const target = e.target as Element | null;
      const el = target?.closest?.("[data-pointer-panel]") as HTMLElement | null;
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
      } else if (target) {
        // Form fields and the video's <video> have no useful text anchor; their element is enough.
        const text = /^(INPUT|TEXTAREA|VIDEO|CANVAS|SELECT)$/.test(target.tagName) ? undefined : textAnchor(el, e.clientX, e.clientY);
        if (text) msg.text = text;
        else msg.el = elementAnchor(el, target, e.clientX, e.clientY);
      }
      conn.sendEphemeral(msg);
    };

    const onMove = (e: PointerEvent) => {
      latest = e;
      if (pending !== null) return;
      const wait = Math.max(0, SEND_EVERY_MS - (performance.now() - lastSent));
      pending = window.setTimeout(send, wait);
    };
    // Scrolling moves content under a still mouse: resend.
    const onScroll = () => {
      if (latest && pending === null) pending = window.setTimeout(send, SEND_EVERY_MS);
    };
    const onLeave = () => {
      latest = null;
      if (lastPanel !== null) conn.sendEphemeral({ k: "ptr", panel: null });
      lastPanel = null;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      off();
      if (pending !== null) window.clearTimeout(pending);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll, { capture: true });
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [conn]);

  return remote;
}

// Resolving the anchor walks the panel's text; do it once per message, not every frame.
// (Misses aren't cached: the content may appear a moment later, e.g. once the problem loads.)
const resolved = new WeakMap<RemotePtr, Node>();
function cached<T extends Node>(ptr: RemotePtr, find: () => T | null): T | null {
  const hit = resolved.get(ptr);
  if (hit?.isConnected) return hit as T;
  const node = find();
  if (node) resolved.set(ptr, node);
  return node;
}

/** Where the pointer goes on our screen, or null if its content isn't visible here. */
export function locatePointer(ptr: RemotePtr, editor: EditorView | null): { x: number; y: number } | null {
  const panel = document.querySelector<HTMLElement>(`[data-pointer-panel="${ptr.panel}"]`);
  if (!panel || panel.offsetParent === null) return null;
  const r = panel.getBoundingClientRect();

  if (ptr.panel === "editor" && editor && ptr.pos !== undefined && ptr.pos <= editor.state.doc.length) {
    const at = editor.coordsAtPos(ptr.pos);
    if (!at) return null; // scrolled out of the rendered viewport
    const x = at.left + (ptr.dx ?? 0);
    const y = at.top + (ptr.dy ?? 0);
    return visibleWithin(editor.scrollDOM, panel, x, y) ? { x, y } : null;
  }
  if (ptr.text) {
    const a = ptr.text;
    const node = cached(ptr, () => findText(panel, a));
    const cr = node && charRect(node, ptr.text.off);
    if (node && cr) {
      const x = cr.left + ptr.text.dx;
      const y = cr.top + ptr.text.dy;
      return visibleWithin(node, panel, x, y) ? { x, y } : null;
    }
  }
  if (ptr.el) {
    const a = ptr.el;
    const el = cached(ptr, () => findElement(panel, a));
    const er = el?.getBoundingClientRect();
    if (el && er && (er.width || er.height)) {
      const x = er.left + ptr.el.fx * er.width;
      const y = er.top + ptr.el.fy * er.height;
      return visibleWithin(el, panel, x, y) ? { x, y } : null;
    }
  }
  // Content we can't find (different tab open, problem not loaded yet…): same spot in the panel.
  return { x: r.left + ptr.x * r.width, y: r.top + ptr.y * r.height };
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

  // Re-place every frame so it tracks scrolling, resizing and re-rendering on our side.
  useEffect(() => {
    if (!ptr) return;
    let raf = 0;
    const place = () => {
      raf = requestAnimationFrame(place);
      const node = ref.current;
      if (!node) return;
      const at = locatePointer(ptr, editor);
      node.style.opacity = at ? "1" : "0";
      if (at) node.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
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
