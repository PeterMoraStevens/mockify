import * as React from "react";

/**
 * /room/new is a route handler that mints a room ID and redirects, so it must
 * be a plain full-page navigation. A <Link> could prefetch it and burn IDs.
 */
export function NewRoomLink(props: Omit<React.ComponentProps<"a">, "href">) {
  return <a href={"/room/new"} {...props} />;
}
