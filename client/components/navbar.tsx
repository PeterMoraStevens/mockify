import React from "react";
import { Button } from "./ui/button";
import { ModeToggle } from "./theme-toggle";
import { Plus, UserPlus2Icon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

const Navbar = () => {
  return (
    <div className="absolute z-99 justify-between top-0 flex bg-secondary-background w-full min-h-8 border-b-4 border-black p-4">
      <div className="flex gap-4">
        <Button>Home</Button>
        <Button>
          Create Room <Plus />
        </Button>
        <Button>
          Join Room <UserPlus2Icon />
        </Button>
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

export default Navbar;
