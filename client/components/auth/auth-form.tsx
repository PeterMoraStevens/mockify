"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";

export function AuthForm({
  next,
  signupsOpen,
  inviteRequired,
  initialMode,
}: {
  next: string;
  signupsOpen: boolean;
  inviteRequired: boolean;
  initialMode: Mode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(signupsOpen ? initialMode : "login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-base border-4 border-border bg-secondary-background shadow-xl">
      {signupsOpen && (
        <div className="grid grid-cols-2 border-b-4 border-border">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cn(
                "py-3 font-heading transition-colors first:border-r-4 first:border-border",
                mode === m ? "bg-main text-main-foreground" : "hover:bg-background",
              )}
            >
              {m === "login" ? "Log in" : "Create account"}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="space-y-5 p-6 sm:p-8">
        <div>
          <h2 className="text-2xl">{mode === "login" ? "Welcome back" : "Make an account"}</h2>
          <p className="mt-1 text-sm text-muted">
            {mode === "login" ? "Log in to join or start a room." : "Takes ten seconds. No email needed."}
          </p>
        </div>

        <Field label="Username" htmlFor="username">
          <Input id="username" name="username" autoComplete="username" required minLength={3} maxLength={32} />
        </Field>
        {mode === "signup" && (
          <Field label="Display name" htmlFor="displayName" hint="This is what the other person sees in the room.">
            <Input id="displayName" name="displayName" autoComplete="name" required maxLength={60} />
          </Field>
        )}
        <Field label="Password" htmlFor="password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "signup" ? 8 : 1}
          />
        </Field>
        {mode === "signup" && inviteRequired && (
          <Field label="Invite code" htmlFor="inviteCode" hint="This server is invite-only.">
            <Input id="inviteCode" name="inviteCode" required />
          </Field>
        )}

        {error && (
          <div role="alert" className="rounded-base border-2 border-border bg-accent-red px-3 py-2 text-sm font-heading text-black">
            {error}
          </div>
        )}

        <Button type="submit" className="h-12 w-full text-base font-heading" disabled={busy}>
          {busy ? <Spinner /> : mode === "login" ? "Log in" : "Create account"}
          {!busy && <ArrowRight />}
        </Button>
        {!signupsOpen && <p className="text-center text-xs text-muted">New sign-ups are closed on this server.</p>}
      </form>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
