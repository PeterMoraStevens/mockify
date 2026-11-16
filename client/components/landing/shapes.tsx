/**
 * Decorative brutalist blocks that sit behind the landing page's cards:
 * thick-bordered squares, circles, a triangle, a zig-zag and stripes, offset
 * and rotated so they peek out from behind. Purely visual (aria-hidden) and
 * hidden on small screens where they'd crowd the content.
 */
export function Shapes({ variant }: { variant: "hero" | "features" }) {
  return variant === "hero" ? (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden sm:block">
      <div className="absolute -right-6 -top-10 size-36 rotate-12 rounded-base border-4 border-border bg-accent-yellow shadow-shadow" />
      <div className="absolute -left-10 top-1/3 size-24 rounded-full border-4 border-border bg-accent-blue" />
      <div className="absolute -bottom-12 right-10 h-20 w-56 -rotate-3 border-4 border-border bg-stripes" />
      <svg className="absolute -bottom-14 -left-6 size-28 rotate-[-8deg] overflow-visible" viewBox="0 0 100 100">
        <polygon points="50,6 96,94 4,94" className="fill-accent-green stroke-border" strokeWidth="6" strokeLinejoin="round" />
      </svg>
      <svg className="absolute -top-8 left-1/3 h-8 w-40 overflow-visible" viewBox="0 0 160 30">
        <polyline points="0,25 20,5 40,25 60,5 80,25 100,5 120,25 140,5 160,25" fill="none" className="stroke-border" strokeWidth="6" />
      </svg>
    </div>
  ) : (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden sm:block">
      <div className="absolute -left-8 -top-8 size-28 -rotate-6 rounded-base border-4 border-border bg-main" />
      <div className="absolute -right-8 top-1/4 size-32 rounded-full border-4 border-border bg-accent-green" />
      <div className="absolute -bottom-10 left-1/4 h-16 w-64 rotate-2 border-4 border-border bg-stripes" />
      <div className="absolute -bottom-8 -right-4 size-20 rotate-45 border-4 border-border bg-accent-blue" />
      <div className="absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rotate-12 rounded-base border-4 border-border bg-accent-yellow" />
    </div>
  );
}
