"use client";

import { indentWithTab } from "@codemirror/commands";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { php } from "@codemirror/lang-php";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { indentUnit, StreamLanguage, type LanguageSupport } from "@codemirror/language";
import { c, csharp, dart, kotlin, scala } from "@codemirror/legacy-modes/mode/clike";
import { go } from "@codemirror/legacy-modes/mode/go";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { yCollab } from "y-codemirror.next";
import * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import type { LanguageId } from "@/lib/languages";

const legacy = (mode: Parameters<typeof StreamLanguage.define>[0]) => () => StreamLanguage.define(mode);

const LANG: Record<LanguageId, () => LanguageSupport | Extension> = {
  python: () => python(),
  javascript: () => javascript(),
  typescript: () => javascript({ typescript: true }),
  java: () => java(),
  c: legacy(c),
  cpp: () => cpp(),
  csharp: legacy(csharp),
  go: legacy(go),
  rust: () => rust(),
  kotlin: legacy(kotlin),
  swift: legacy(swift),
  ruby: legacy(ruby),
  php: () => php(),
  scala: legacy(scala),
  dart: legacy(dart),
  bash: legacy(shell),
};

const INDENT: Record<LanguageId, string> = {
  python: "    ",
  javascript: "  ",
  typescript: "  ",
  java: "    ",
  c: "    ",
  cpp: "    ",
  csharp: "    ",
  go: "\t",
  rust: "    ",
  kotlin: "    ",
  swift: "    ",
  ruby: "  ",
  php: "    ",
  scala: "  ",
  dart: "  ",
  bash: "  ",
};

const lightTheme = EditorView.theme(
  {
    "&": { backgroundColor: "var(--secondary-background)", color: "var(--foreground)" },
    ".cm-gutters": {
      backgroundColor: "var(--background)",
      borderRight: "2px solid var(--border)",
      color: "color-mix(in oklch, var(--foreground) 45%, transparent)",
    },
    ".cm-activeLine": { backgroundColor: "color-mix(in oklch, var(--main) 10%, transparent)" },
    ".cm-activeLineGutter": { backgroundColor: "color-mix(in oklch, var(--main) 25%, transparent)", color: "var(--foreground)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "color-mix(in oklch, var(--main) 35%, transparent) !important",
    },
    ".cm-cursor": { borderLeftColor: "var(--foreground)", borderLeftWidth: "2px" },
  },
  { dark: false },
);

const darkOverrides = EditorView.theme(
  {
    ".cm-gutters": { borderRight: "2px solid var(--border)" },
  },
  { dark: true },
);

export function CodeEditor({
  ytext,
  awareness,
  language,
  readOnly = false,
}: {
  ytext: Y.Text;
  awareness: Awareness;
  language: LanguageId;
  readOnly?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const langC = useRef(new Compartment());
  const themeC = useRef(new Compartment());
  const roC = useRef(new Compartment());
  const { resolvedTheme } = useTheme();
  const initial = useRef({ language, dark: resolvedTheme === "dark", readOnly });

  useEffect(() => {
    if (!host.current) return;
    const undoManager = new Y.UndoManager(ytext);
    const { language: lang, dark, readOnly: ro } = initial.current;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: ytext.toString(),
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          placeholder("Pick a problem, or just start typing…"),
          langC.current.of([LANG[lang](), indentUnit.of(INDENT[lang])]),
          themeC.current.of(dark ? [oneDark, darkOverrides] : lightTheme),
          roC.current.of(EditorState.readOnly.of(ro)),
          yCollab(ytext, awareness, { undoManager }),
          EditorView.lineWrapping,
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      undoManager.destroy();
      view.current = null;
    };
  }, [ytext, awareness]);

  useEffect(() => {
    view.current?.dispatch({
      effects: langC.current.reconfigure([LANG[language](), indentUnit.of(INDENT[language])]),
    });
  }, [language]);

  useEffect(() => {
    view.current?.dispatch({
      effects: themeC.current.reconfigure(resolvedTheme === "dark" ? [oneDark, darkOverrides] : lightTheme),
    });
  }, [resolvedTheme]);

  useEffect(() => {
    view.current?.dispatch({ effects: roC.current.reconfigure(EditorState.readOnly.of(readOnly)) });
  }, [readOnly]);

  return <div ref={host} className="h-full min-h-0 overflow-hidden" />;
}
