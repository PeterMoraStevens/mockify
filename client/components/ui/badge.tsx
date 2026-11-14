import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-base border-2 border-border px-2 py-0.5 text-xs font-heading uppercase tracking-wide text-black [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        main: "bg-main",
        neutral: "bg-secondary-background text-foreground",
        blue: "bg-accent-blue",
        yellow: "bg-accent-yellow",
        green: "bg-accent-green",
        red: "bg-accent-red",
        violet: "bg-accent-violet",
      },
      shadow: { true: "shadow-shadow", false: "" },
    },
    defaultVariants: { tone: "main", shadow: false },
  },
);

export function Badge({
  className,
  tone,
  shadow,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, shadow }), className)} {...props} />;
}

export function DifficultyBadge({ difficulty }: { difficulty: "easy" | "medium" | "hard" }) {
  const tone = difficulty === "easy" ? "green" : difficulty === "medium" ? "yellow" : "red";
  return <Badge tone={tone}>{difficulty}</Badge>;
}
