"use client";

import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { darkOverrides, INDENT, LANG, lightTheme } from "@/components/room/code-editor";
import type { LanguageId } from "@/lib/languages";

/** A standalone CodeMirror editor (no collaboration), for the problem builder. */
export function PlainEditor({
  value,
  onChange,
  language,
  readOnly = false,
  className,
}: {
  value: string;
  onChange?: (v: string) => void;
  language: LanguageId;
  readOnly?: boolean;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const langC = useRef(new Compartment());
  const themeC = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const { resolvedTheme } = useTheme();
  const initial = useRef({ value, language, dark: resolvedTheme === "dark" });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!host.current) return;
    const { value: v0, language: l0, dark } = initial.current;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: v0,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          langC.current.of([LANG[l0](), indentUnit.of(INDENT[l0])]),
          themeC.current.of(dark ? [oneDark, darkOverrides] : lightTheme),
          EditorState.readOnly.of(readOnly),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
  }, [readOnly]);

  // Outside changes (signature regenerated the starter, a draft loaded).
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: langC.current.reconfigure([LANG[language](), indentUnit.of(INDENT[language])]) });
  }, [language]);

  useEffect(() => {
    view.current?.dispatch({ effects: themeC.current.reconfigure(resolvedTheme === "dark" ? [oneDark, darkOverrides] : lightTheme) });
  }, [resolvedTheme]);

  return <div ref={host} className={className} />;
}
