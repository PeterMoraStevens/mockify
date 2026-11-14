"use client";

import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { useTheme } from "next-themes";

/** The final whiteboard, view-only (pan and zoom still work). */
export default function BoardView({ elements }: { elements: OrderedExcalidrawElement[] }) {
  const { resolvedTheme } = useTheme();
  return (
    <div className="excalidraw-host h-[60vh] w-full">
      <Excalidraw
        initialData={{ elements, scrollToContent: true }}
        viewModeEnabled
        zenModeEnabled
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        UIOptions={{ tools: { image: false }, canvasActions: { loadScene: false, saveToActiveFile: false, export: { saveFileToDisk: true } } }}
      />
    </div>
  );
}
