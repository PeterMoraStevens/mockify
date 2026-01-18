import { Button } from "@/components/ui/button";
import { Highlighter } from "@/components/ui/highlighter";
import Marquee from "@/components/ui/marquee";
import { TextAnimate } from "@/components/ui/text-animate";
import { Plus, StarsIcon, UserPlus2Icon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="dark:bg-secondary-background bg-background">
      <div className="flex flex-col min-h-screen self-center justify-center not-prose w-full items-center z-15 relative mb-5 bg-[linear-gradient(to_right,#8080804D_1px,transparent_1px),linear-gradient(to_bottom,#80808090_1px,transparent_1px)] shadow-shadow bg-size-[40px_40px]">
        <div className="flex flex-col justify-center max-w-3/4 mb-24 bg-secondary-background px-12 py-10 border-4 shadow-shadow">
          <TextAnimate
            className="text-6xl text-center"
            animation="blurIn"
            by="character"
            once
            duration={0.75}
          >
            Welcome to Mockify!
          </TextAnimate>
          <div className="text-center text-2xl pt-4">
            An{" "}
            <Highlighter action="underline" color="#FF9800">
              open-source
            </Highlighter>{" "}
            mock interview platform with{" "}
            <Highlighter action="box" color="#FF9800">
              minimal complexity
            </Highlighter>
            .
          </div>
          <div className="text-center text-2xl pt-2">
            Use our platform or even host your own!
          </div>
          <div className="flex items-center gap-2 justify-center p-4">
            <Button>
              Create Room <Plus />
            </Button>
            <Link href={"/join-room"}>
              <Button className="hover:cursor-pointer">
                Join Room <UserPlus2Icon />
              </Button>
            </Link>
          </div>
        </div>
        <Marquee
          items={[
            "Dozens of Programming Languages Supported",
            "|",
            "Live Video & Audio",
            "|",
            "Shared IDE & Real Time Updates",
            "|",
          ]}
        />
      </div>
    </div>
  );
}
