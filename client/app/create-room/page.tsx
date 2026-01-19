/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DURATIONS = [
  { label: "30 minutes", value: 30 },
  { label: "45 minutes", value: 45 },
  { label: "60 minutes", value: 60 },
  { label: "90 minutes", value: 90 },
  { label: "120 minutes", value: 120 },
];

const Page = () => {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userOk, setUserOk] = useState(false);

  const [durationMinutes, setDurationMinutes] = useState<number>(60);

  useEffect(() => {
    let active = true;

    async function check() {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;

      setUserOk(!error && !!data.user);
      setCheckingAuth(false);
    }

    check();
    return () => {
      active = false;
    };
  }, [supabase]);

  const handleCreate = async () => {
    if (!userOk) {
      toast.error("Please log in to create a room.");
      router.push(`/login?next=/create-room`);
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationMinutes }),
      });

      const body: any = await res.json().catch(() => ({}));

      // Handle auth error cleanly
      if (res.status === 401) {
        toast.error(body?.error ?? "Please log in again.");
        router.push(`/login?next=/create-room`);
        return;
      }

      // Handle server errors
      if (!res.ok) {
        toast.error(body?.error ?? "Failed to create room");
        return;
      }

      const code = (body?.code ?? "").toString().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) {
        toast.error("Server returned an invalid room code.");
        return;
      }

      if (body?.alreadyExists) {
        toast.info(`You already have an active room: ${code}`);
      } else {
        toast.success(`Room created: ${code}`);
      }

      router.push(`/room/${code}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mt-48 flex justify-center w-full mx-auto">
        <Card className="w-full max-w-sm bg-main/80">
          <CardHeader>
            <CardTitle>Create a Room</CardTitle>
            <CardDescription>
              Choose how long the room should last (30 minutes to 2 hours).
              We&apos;ll generate a unique 6-character code. Up to 6 people can
              join.
            </CardDescription>
          </CardHeader>

          <div className="px-6">
            <div className="text-sm mb-2 opacity-80">Room duration</div>
            <Select
              value={String(durationMinutes)}
              onValueChange={(v) => setDurationMinutes(Number(v))}
            >
              <SelectTrigger className="w-full shadow-shadow hover:cursor-pointer">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <CardFooter className="flex-col gap-2">
            <Button
              variant="neutral"
              className="w-full"
              onClick={handleCreate}
              disabled={loading || checkingAuth}
            >
              {loading ? (
                <>
                  Creating <Spinner />
                </>
              ) : (
                "Create Room"
              )}
            </Button>

            <div className="mt-4 text-center text-sm">
              Already have a code?{" "}
              <Link href="/join-room" className="underline underline-offset-4">
                Join a room
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Page;
