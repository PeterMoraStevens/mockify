"use client";

import { EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, lineNumbers } from "@codemirror/view";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { darkOverrides, LANG, lightTheme } from "@/components/room/code-editor";
import { isLanguageId } from "@/lib/languages";

/** Read-only, highlighted code for the interview summary. */
export function CodeView({ code, language }: { code: string; language: string | null }) {
  const host = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!host.current) return;
    const lang = language && isLanguageId(language) ? LANG[language]() : [];
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: code,
        extensions: [
          lineNumbers(),
          lang,
          resolvedTheme === "dark" ? [oneDark, darkOverrides] : lightTheme,
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          EditorView.lineWrapping,
        ],
      }),
    });
    return () => v.destroy();
  }, [code, language, resolvedTheme]);

  return <div ref={host} className="cm-host max-h-[70vh] overflow-auto [&_.cm-editor]:h-auto" />;
}
