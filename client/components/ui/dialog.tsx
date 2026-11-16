"use client";

import { X } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  dismissible = true,
}: {
  /** false: no close button, Escape and clicking outside do nothing (a step that must be finished). */
  dismissible?: boolean;
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, dismissible]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-overlay/60 p-4 animate-in fade-in-0"
      onMouseDown={(e) => dismissible && e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-base border-2 border-border bg-secondary-background p-6 shadow-xl animate-in zoom-in-95",
          className,
        )}
      >
        {dismissible && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-base border-2 border-border bg-background p-1 hover:bg-main"
          >
            <X className="size-4" />
          </button>
        )}
        <h2 id={titleId} className="pr-10 text-xl">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
