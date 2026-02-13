"use client";

import { useEffect, useRef, useState } from "react";
import type { Awareness } from "y-protocols/awareness";

type UserState = {
  user?: { name: string; color: string };
  selection?: unknown;
};

type RemoteUser = {
  clientID: number;
  name: string;
  color: string;
};

// Convert an HSL color string like "hsl(180, 70%, 50%)" to an HSLA string with alpha
function withAlpha(hsl: string, alpha: number): string {
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (match) {
    return `hsla(${match[1]}, ${match[2]}%, ${match[3]}%, ${alpha})`;
  }
  return hsl;
}

/**
 * Injects dynamic CSS styles for y-monaco remote cursor/selection decorations
 * and renders floating name labels at cursor positions.
 */
export function RemoteCursorStyles({
  awareness,
}: {
  awareness: Awareness | null;
}) {
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const styleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    if (!awareness) return;

    const updateUsers = () => {
      const users: RemoteUser[] = [];
      awareness.getStates().forEach((state: UserState, clientID: number) => {
        if (clientID !== awareness.clientID && state.user) {
          users.push({
            clientID,
            name: state.user.name,
            color: state.user.color,
          });
        }
      });
      setRemoteUsers(users);
    };

    awareness.on("change", updateUsers);
    updateUsers();

    return () => {
      awareness.off("change", updateUsers);
    };
  }, [awareness]);

  // Generate and inject dynamic CSS for each remote user's color
  useEffect(() => {
    if (styleRef.current) {
      styleRef.current.remove();
    }

    if (remoteUsers.length === 0) return;

    const style = document.createElement("style");
    style.setAttribute("data-yjs-cursors", "true");

    const css = remoteUsers
      .map(
        (u) => `
/* Selection highlight for ${u.name} */
.yRemoteSelection-${u.clientID} {
  background-color: ${withAlpha(u.color, 0.2)};
}

/* Cursor head (after content) for ${u.name} */
.yRemoteSelectionHead-${u.clientID}::after {
  content: "${u.name}";
  position: absolute;
  border-left: 2px solid ${u.color};
  border-top: 2px solid ${u.color};
  border-right: 2px solid ${u.color};
  background-color: ${u.color};
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 3px 3px 3px 0;
  white-space: nowrap;
  top: -18px;
  left: -2px;
  pointer-events: none;
  z-index: 100;
  line-height: 14px;
}

/* Cursor line for ${u.name} */
.yRemoteSelectionHead-${u.clientID} {
  position: relative;
  border-left: 2px solid ${u.color};
  margin-left: -2px;
}
`
      )
      .join("\n");

    style.textContent = css;
    document.head.appendChild(style);
    styleRef.current = style;

    return () => {
      if (styleRef.current) {
        styleRef.current.remove();
        styleRef.current = null;
      }
    };
  }, [remoteUsers]);

  return null;
}
