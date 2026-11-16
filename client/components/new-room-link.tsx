import Link from "next/link";
import * as React from "react";

/** Goes to the room options page. Nothing is created until you confirm there. */
export function NewRoomLink({
  mode,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & { mode?: "coding" | "design" }) {
  return <Link href={mode === "design" ? "/room/new?mode=design" : "/room/new"} {...props} />;
}
