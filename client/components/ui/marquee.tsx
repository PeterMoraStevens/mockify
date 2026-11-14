import { cn } from "@/lib/utils";

export default function Marquee({ items, className }: { items: string[]; className?: string }) {
  const row = (aria: boolean) =>
    items.map((item, i) => (
      <span key={i} aria-hidden={aria || undefined} className="mx-6 inline-flex items-center gap-6 text-2xl font-heading sm:text-3xl">
        {item}
        <span className="inline-block size-3 rotate-45 border-2 border-border bg-secondary-background" />
      </span>
    ));
  return (
    <div
      className={cn(
        "relative flex w-full overflow-x-hidden border-y-4 border-border bg-main text-main-foreground",
        className,
      )}
    >
      <div className="animate-marquee whitespace-nowrap py-5">{row(false)}</div>
      <div className="absolute top-0 animate-marquee2 whitespace-nowrap py-5">{row(true)}</div>
    </div>
  );
}
