"use client";

import { BookOpen, DoorOpen, LogIn, Plus } from "lucide-react";
import Link from "next/link";
import { NewRoomLink } from "@/components/new-room-link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";
import { ModeToggle } from "./theme-toggle";
import { Button } from "./ui/button";
import { InviteBadge, NotificationBell, NotificationWatcher } from "./notifications";
import { UserMenu } from "./user-menu";
import { cn } from "@/lib/utils";

type NavUser = { displayName: string; username: string } | null;

const LINKS = [
  { href: "/problems", label: "Problems", icon: BookOpen },
  { href: "/rooms", label: "Rooms", icon: DoorOpen },
];

export default function Navbar({ user }: { user: NavUser }) {
  const path = usePathname();
  // The room has its own header (but still hears about invites).
  if (/^\/room\/[a-z0-9]{20}/.test(path)) return user ? <NotificationWatcher /> : null;

  return (
    <header className="sticky top-0 z-50 border-b-4 border-border bg-secondary-background">
      {user && <NotificationWatcher />}
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-4">
        <Logo />
        <div className="ml-4 hidden items-center gap-1 md:flex">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = path === href || path.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-base border-2 px-3 py-1.5 text-sm font-heading transition-all",
                  active
                    ? "border-border bg-main text-main-foreground shadow-shadow"
                    : "border-transparent hover:border-border hover:bg-background",
                )}
              >
                <Icon className="size-4" />
                {label}
                {href === "/rooms" && user && <InviteBadge />}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <NewRoomLink>
              New interview <Plus />
            </NewRoomLink>
          </Button>
          {user && <NotificationBell />}
          {user ? (
            <UserMenu displayName={user.displayName} username={user.username} />
          ) : (
            <Button asChild size="sm" variant="neutral">
              <Link href={`/login${path !== "/" ? `?next=${encodeURIComponent(path)}` : ""}`}>
                Log in <LogIn />
              </Link>
            </Button>
          )}
          <ModeToggle />
        </div>
      </nav>
    </header>
  );
}
