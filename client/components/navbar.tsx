"use client";

import React from "react";
import { Button } from "./ui/button";
import { ModeToggle } from "./theme-toggle";
import { Plus, UserPlus2Icon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { usePathname } from "next/navigation";
import Link from "next/link";

const LandingNavbar = () => {
  const url = usePathname();

  return (
    <div className="sticky z-99 justify-between top-0 flex bg-secondary-background w-full min-h-8 border-b-4 border-black p-4">
      <div className="flex gap-4">
        <Link href={"/"}>
          <Button className={url === "/" ? "bg-amber-500" : ""}>Home</Button>
        </Link>
        <Link href={"/create-room"}>
          <Button className={url.includes("create-room") ? "bg-amber-500" : ""}>
            Create Room <Plus />
          </Button>
        </Link>
        <Link href={"/join-room"}>
          <Button className={url.includes("join-room") ? "bg-amber-500" : ""}>
            Join Room <UserPlus2Icon />
          </Button>
        </Link>
      </div>
      <div className="flex gap-4">
        <Avatar>
          <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
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
        <Avatar>
          <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
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
