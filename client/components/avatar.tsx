import { cn } from "@/lib/utils";

const COLORS = ["bg-main", "bg-accent-blue", "bg-accent-yellow", "bg-accent-green", "bg-accent-violet", "bg-accent-red"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({
  name,
  className,
  colorClass,
}: {
  name: string;
  className?: string;
  colorClass?: string;
}) {
  return (
    <span
      className={cn(
        "grid size-10 place-items-center rounded-base border-2 border-border font-heading text-sm text-black shadow-shadow",
        colorClass ?? COLORS[hash(name) % COLORS.length],
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
