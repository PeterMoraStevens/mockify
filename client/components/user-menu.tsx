"use client";

import { BookOpen, DoorOpen, Library, LogOut, Upload, User, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar } from "./avatar";

export function UserMenu({ displayName, username }: { displayName: string; username: string }) {
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-base outline-none focus-visible:ring-2 focus-visible:ring-black">
        <Avatar name={displayName} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-100 w-56">
        <DropdownMenuLabel>
          <div className="font-heading">{displayName}</div>
          <div className="text-xs font-base opacity-70">@{username}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User /> Profile &amp; feedback
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/friends">
            <UserPlus /> Friends
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="md:hidden">
          <Link href="/rooms">
            <DoorOpen /> Your rooms
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="md:hidden">
          <Link href="/problems">
            <BookOpen /> Problems
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/problems/new">
            <Upload /> Create a problem
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/problems/library">
            <Library /> Your problems &amp; drafts
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
