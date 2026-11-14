"use client";

import { BookOpen, LogOut, Upload, User, Users } from "lucide-react";
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
        <DropdownMenuItem asChild className="md:hidden">
          <Link href="/problems">
            <BookOpen /> Problems
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="md:hidden">
          <Link href="/match">
            <Users /> Find a partner
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/problems/new">
            <Upload /> Upload a problem
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
