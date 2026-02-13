"use client";

import { useSyncExternalStore } from "react";
import { Button } from "./ui/button";
import { ModeToggle } from "./theme-toggle";
import { Plus, UserPlus2Icon, DoorOpen } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { CurrentUserAvatar } from "./current-user-avatar";

function getActiveRoomCode(): string | null {
  try {
    const raw = localStorage.getItem("mockify_active_room");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
      return parsed.code;
    }
    localStorage.removeItem("mockify_active_room");
    return null;
  } catch {
    localStorage.removeItem("mockify_active_room");
    return null;
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

function useActiveRoom() {
  return useSyncExternalStore(subscribe, getActiveRoomCode, () => null);
}

const LandingNavbar = () => {
  const url = usePathname();
  const { user } = useAuth();
  const activeRoom = useActiveRoom();

  return (
    <div className="sticky z-99 justify-between top-0 flex bg-secondary-background w-full min-h-8 border-b-4 border-black p-4">
      <div className="flex gap-4">
        <Link href={"/"}>
          <Button className={url === "/" ? "bg-amber-500" : ""}>Home</Button>
        </Link>
        <Link href={"/create-room"}>
          <Button
            className={url.includes("create-room") ? "bg-amber-500" : ""}
          >
            Create Room <Plus />
          </Button>
        </Link>
        <Link href={"/join-room"}>
          <Button className={url.includes("join-room") ? "bg-amber-500" : ""}>
            Join Room <UserPlus2Icon />
          </Button>
        </Link>
        {activeRoom && (
          <Link href={`/room/${activeRoom}`}>
            <Button className="bg-green-500 hover:bg-green-600">
              Rejoin Room <DoorOpen />
            </Button>
          </Link>
        )}
      </div>
      <div className="flex gap-4">
        {user ? (
          <CurrentUserAvatar />
        ) : (
          <Link href={"/auth/login"}>
            <Button className={url.includes("login") ? "bg-amber-500" : ""}>
              Login
            </Button>
          </Link>
        )}

        <ModeToggle />
      </div>
    </div>
  );
};

const RoomNavbar = () => {
  const url = usePathname();

  return (
    <div className="sticky z-99 justify-between top-0 flex bg-secondary-background w-full min-h-8 border-b-4 border-black p-4">
      <div className="flex gap-4">
        <Link href={"/"}>
          <Button className={url === "/" ? "bg-amber-500" : ""}>Home</Button>
        </Link>
      </div>
      <div className="flex gap-4">
        <CurrentUserAvatar />
        <ModeToggle />
      </div>
    </div>
  );
};

const Navbar = () => {
  const url = usePathname();

  if (url.includes("/room/")) {
    return <RoomNavbar />;
  } else {
    return <LandingNavbar />;
  }
};

export default Navbar;
