import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group flex items-center gap-2 font-heading text-lg", className)}>
      <span className="grid size-8 place-items-center rounded-base border-2 border-border bg-main text-main-foreground shadow-shadow transition-transform group-hover:-rotate-6">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square">
          <path d="M8 7 3 12l5 5M16 7l5 5-5 5" />
        </svg>
      </span>
      <span className="tracking-tight">mockify</span>
    </Link>
  );
}
