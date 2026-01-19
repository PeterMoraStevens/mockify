/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";

const isAlnum6 = (s: string) => /^[A-Z0-9]{6}$/.test(s);

const Page = () => {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [roomCode, setRoomCode] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userOk, setUserOk] = useState(false);

  // Require auth
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

  const handleJoinRoomButtonClick = async () => {
    const code = roomCode.toUpperCase();

    if (!userOk) {
      toast.error("Please log in to join a room.");
      router.push(`/login?next=/join-room`);
      return;
    }

    if (!isAlnum6(code)) {
      toast.error("Code must be 6 characters (A–Z, 0–9).");
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      // Join first (enforces: room exists, not full, membership recorded)
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error ?? "Failed to join room");
        return;
      }

      toast.success(`Joined room ${code}`);
      router.push(`/room/${code}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to join room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mt-48 flex justify-center w-full mx-auto">
        <Card className="w-full max-w-sm bg-main/80">
          <CardHeader>
            <CardTitle>Join Room With Code</CardTitle>
            <CardDescription>Enter your 6 character code below</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col items-center gap-3">
            <InputOTP
              value={roomCode}
              onChange={(value) => setRoomCode(value.toUpperCase())}
              maxLength={6}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </CardContent>

          <CardFooter className="flex-col gap-2">
            <Button
              variant="neutral"
              className="w-full"
              onClick={handleJoinRoomButtonClick}
              disabled={loading || checkingAuth}
            >
              {loading ? (
                <>
                  Joining <Spinner />
                </>
              ) : (
                "Join Room"
              )}
            </Button>

            <div className="mt-4 text-center text-sm">
              Don&apos;t have a code?{" "}
              <Link
                href="/create-room"
                className="underline underline-offset-4"
              >
                Create a room here
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Page;
