"use client";

import { foldedRanges, foldEffect, unfoldEffect } from "@codemirror/language";
import { Annotation, type Extension, type StateEffect } from "@codemirror/state";
import { ViewPlugin, type EditorView, type ViewUpdate } from "@codemirror/view";
import * as Y from "yjs";

/**
 * Folded sections are part of the shared session: fold or unfold something
 * and the other person's editor follows. Each fold is stored in the doc's
 * `folds` map as a pair of Yjs relative positions, so it stays attached to the
 * same code while either person edits around it.
 */

export type FoldEntry = { from: unknown; to: unknown };
type Range = { from: number; to: number };

export const getFolds = (doc: Y.Doc) => doc.getMap<FoldEntry>("folds");

export function foldEntry(ytext: Y.Text, r: Range): FoldEntry {
  return {
    from: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(ytext, r.from)),
    // assoc -1: typing right after the fold doesn't grow it.
    to: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(ytext, r.to, -1)),
  };
}

function resolve(ytext: Y.Text, e: FoldEntry): Range | null {
  const doc = ytext.doc;
  if (!doc) return null;
  try {
    const a = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(e.from), doc);
    const b = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(e.to), doc);
    if (!a || !b || a.type !== ytext || b.type !== ytext || a.index >= b.index) return null;
    return { from: a.index, to: b.index };
  } catch {
    return null;
  }
}

const fromRemote = Annotation.define<boolean>();
const key = (r: Range) => `${r.from}:${r.to}`;

function ranges(state: EditorView["state"]): Range[] {
  const out: Range[] = [];
  foldedRanges(state).between(0, state.doc.length, (from, to) => void out.push({ from, to }));
  return out;
}

export function sharedFolds(ytext: Y.Text, folds: Y.Map<FoldEntry>): Extension {
  return ViewPlugin.fromClass(
    class {
      /** Marks our own writes so the observer skips them. */
      origin = {};
      pending = false;
      destroyed = false;

      constructor(readonly view: EditorView) {
        folds.observe(this.onMap);
        this.schedule();
      }

      onMap = (e: Y.YMapEvent<FoldEntry>) => {
        if (e.transaction.origin !== this.origin) this.schedule();
      };

      // Y events can fire while CodeMirror is mid-update (yCollab writes to Y
      // from inside one), and dispatching then throws, so apply on a microtask.
      schedule() {
        if (this.pending) return;
        this.pending = true;
        queueMicrotask(() => {
          this.pending = false;
          if (!this.destroyed) this.applyShared();
        });
      }

      /** Make the editor's folds match the shared map. */
      applyShared() {
        const len = this.view.state.doc.length;
        const want = new Map<string, Range>();
        folds.forEach((e) => {
          const r = resolve(ytext, e);
          if (r && r.to <= len) want.set(key(r), r);
        });
        const have = new Map(ranges(this.view.state).map((r) => [key(r), r]));
        const effects: StateEffect<Range>[] = [];
        for (const [k, r] of want) if (!have.has(k)) effects.push(foldEffect.of(r));
        for (const [k, r] of have) if (!want.has(k)) effects.push(unfoldEffect.of(r));
        if (effects.length) this.view.dispatch({ effects, annotations: fromRemote.of(true) });
      }

      update(u: ViewUpdate) {
        if (u.transactions.some((t) => t.annotation(fromRemote))) return;
        // Compare folds before (mapped through any edits) and after. This also
        // catches folds CodeMirror drops on its own, e.g. when the cursor moves
        // into one or its text is deleted, which don't come as unfold effects.
        const before = ranges(u.startState)
          .map((r) => ({ from: u.changes.mapPos(r.from, 1), to: u.changes.mapPos(r.to, -1) }))
          .filter((r) => r.from < r.to);
        const after = ranges(u.state).filter((r) => r.from < r.to);
        const b = new Set(before.map(key));
        const a = new Set(after.map(key));
        const added = after.filter((r) => !b.has(key(r)));
        const removed = before.filter((r) => !a.has(key(r)));
        if (!added.length && !removed.length) return;
        // Write once yCollab has synced this update's text into Y, so positions line up.
        queueMicrotask(() => {
          if (this.destroyed || ytext.length !== this.view.state.doc.length) return;
          ytext.doc?.transact(() => {
            folds.forEach((e, id) => {
              const r = resolve(ytext, e);
              if (!r || removed.some((x) => x.from < r.to && x.to > r.from)) folds.delete(id);
            });
            for (const r of added) folds.set(crypto.randomUUID(), foldEntry(ytext, r));
          }, this.origin);
        });
      }

      destroy() {
        this.destroyed = true;
        folds.unobserve(this.onMap);
      }
    },
  );
}
