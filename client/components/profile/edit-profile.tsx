"use client";

import { KeyRound, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

async function patch(body: object): Promise<string | null> {
  const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  const b = await res.json().catch(() => ({}));
  return b.error ?? `Failed (${res.status})`;
}

export function EditProfile({ username, displayName }: { username: string; displayName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(displayName);
  const [user, setUser] = useState(username);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState<"profile" | "password" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openDialog = () => {
    setName(displayName);
    setUser(username);
    setCurrent("");
    setNext("");
    setError(null);
    setOpen(true);
  };

  const changed = name.trim() !== displayName || user.trim() !== username;

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("profile");
    setError(null);
    const err = await patch({ username: user.trim(), displayName: name.trim() });
    setBusy(null);
    if (err) return setError(err);
    toast.success("Profile updated");
    setOpen(false);
    router.refresh();
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("password");
    setError(null);
    const err = await patch({ currentPassword: current, newPassword: next });
    setBusy(null);
    if (err) return setError(err);
    toast.success("Password changed", { description: "Other devices were signed out." });
    setCurrent("");
    setNext("");
  };

  return (
    <>
      <Button variant="neutral" onClick={openDialog}>
        <Pencil /> Edit profile
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Edit profile" description="Friends find you by username; everyone sees your display name." className="max-w-md">
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <Label htmlFor="pf-name" className="mb-1.5 block">
              Display name
            </Label>
            <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="pf-user" className="mb-1.5 block">
              Username
            </Label>
            <div className="flex items-center gap-1">
              <span className="font-heading text-muted">@</span>
              <Input id="pf-user" value={user} onChange={(e) => setUser(e.target.value)} maxLength={32} autoComplete="username" spellCheck={false} />
            </div>
            <p className="mt-1 text-xs text-muted">3–32 letters, digits, _ . or -. You&apos;ll sign in with the new one.</p>
          </div>
          <Button type="submit" className="w-full" disabled={!changed || !!busy}>
            {busy === "profile" && <Spinner />} Save changes
          </Button>
        </form>

        <form onSubmit={savePassword} className="mt-6 space-y-3 border-t-2 border-border pt-5">
          <div className="flex items-center gap-2 font-heading">
            <KeyRound className="size-4" /> Change password
          </div>
          <Input type="password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          <Input type="password" placeholder="New password (8+ characters)" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          <Button type="submit" variant="neutral" className="w-full" disabled={!current || next.length < 8 || !!busy}>
            {busy === "password" && <Spinner />} Change password
          </Button>
        </form>

        {error && (
          <p role="alert" className="mt-4 rounded-base border-2 border-border bg-accent-red px-3 py-2 text-sm text-black">
            {error}
          </p>
        )}
      </Dialog>
    </>
  );
}
