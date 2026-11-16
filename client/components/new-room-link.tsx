import * as React from "react";

/**
 * /room/new is a route handler that mints a room ID and redirects, so it must
 * be a plain full-page navigation. A <Link> could prefetch it and burn IDs.
 */
export function NewRoomLink({ mode, ...props }: Omit<React.ComponentProps<"a">, "href"> & { mode?: "coding" | "design" }) {
  return <a href={mode === "design" ? "/room/new?mode=design" : "/room/new"} {...props} />;
}
