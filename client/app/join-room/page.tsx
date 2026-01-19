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
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { redirect } from "next/navigation";
import React, { useState } from "react";
import { toast } from "sonner";

const Page = () => {
  const [roomCode, setRoomCode] = useState<string>("");

  const handleJoinRoomButtonClick = () => {
    if (roomCode.length === 6) {
      toast.success(`Joining Room ${roomCode}`);
      redirect(`/room/${roomCode}`);
    } else {
      toast.error(`Issue Joining Room ${roomCode}`);
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
          <CardContent className="flex justify-center">
            <InputOTP
              value={roomCode}
              onChange={(value) => setRoomCode(value)}
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
            >
              Join Room
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
