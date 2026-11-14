import { Check, Mic, MonitorUp, Play, Send, Video, X } from "lucide-react";

/** Static illustration of the room for the hero. Purely decorative. */
export function RoomPreview() {
  return (
    <div className="relative" aria-hidden>
      <div className="absolute -left-4 -top-4 hidden size-24 rotate-12 rounded-base border-2 border-border bg-accent-yellow lg:block" />
      <div className="absolute -bottom-5 -right-3 hidden size-16 -rotate-12 rounded-full border-2 border-border bg-accent-blue lg:block" />

      <div className="relative overflow-hidden rounded-base border-4 border-border bg-secondary-background shadow-xl">
        {/* window bar */}
        <div className="flex items-center gap-2 border-b-2 border-border bg-background px-3 py-2">
          <span className="size-3 rounded-full border-2 border-border bg-accent-red" />
          <span className="size-3 rounded-full border-2 border-border bg-accent-yellow" />
          <span className="size-3 rounded-full border-2 border-border bg-accent-green" />
          <span className="ml-3 truncate font-mono text-xs opacity-70">mockify.home/room/k3x9…</span>
          <span className="ml-auto flex items-center gap-1 rounded-base border-2 border-border bg-accent-green px-1.5 text-[10px] font-heading uppercase text-black">
            <span className="size-1.5 rounded-full bg-black" /> direct &middot; 18ms
          </span>
        </div>

        <div className="grid grid-cols-[1fr_120px] sm:grid-cols-[1fr_150px]">
          {/* editor */}
          <div className="border-r-2 border-border">
            <div className="flex items-center gap-2 border-b-2 border-border px-3 py-1.5 text-xs font-heading">
              <span className="rounded-base border-2 border-border bg-main px-1.5 text-main-foreground">two-sum.py</span>
              <span className="ml-auto flex items-center gap-1 rounded-base border-2 border-border bg-accent-green px-1.5 text-black">
                <Play className="size-3" /> Run
              </span>
              <span className="flex items-center gap-1 rounded-base border-2 border-border bg-main px-1.5 text-main-foreground">
                <Send className="size-3" /> Submit
              </span>
            </div>
            <pre className="overflow-hidden px-3 py-3 font-mono text-[11px] leading-5 sm:text-xs">
              <code>
                <span className="text-chart-5">def</span> <span className="text-chart-2">solve</span>(nums, target):{"\n"}
                {"    "}seen = {"{}"}
                {"\n"}
                {"    "}
                <span className="text-chart-5">for</span> i, x <span className="text-chart-5">in</span> enumerate(nums):{"\n"}
                {"        "}
                <span className="text-chart-5">if</span> target - x <span className="text-chart-5">in</span> seen:
                <span className="relative">
                  <span className="absolute -top-4 left-1 rounded-sm border border-border bg-accent-blue px-1 font-sans text-[9px] font-bold text-black">
                    Sam
                  </span>
                  <span className="ml-0.5 inline-block h-3.5 w-0.5 translate-y-0.5 bg-accent-blue" />
                </span>
                {"\n"}
                {"            "}
                <span className="text-chart-5">return</span> [seen[target - x], i]{"\n"}
                {"        "}seen[x] = i
                <span className="ml-0.5 inline-block h-3.5 w-0.5 translate-y-0.5 bg-main" />
              </code>
            </pre>
            <div className="space-y-1 border-t-2 border-border bg-background px-3 py-2 text-[11px] font-heading">
              <div className="flex items-center gap-2">
                <span className="grid size-4 place-items-center rounded-sm border-2 border-border bg-accent-green text-black">
                  <Check className="size-2.5" strokeWidth={4} />
                </span>
                Example 1 &middot; 24ms
              </div>
              <div className="flex items-center gap-2">
                <span className="grid size-4 place-items-center rounded-sm border-2 border-border bg-accent-green text-black">
                  <Check className="size-2.5" strokeWidth={4} />
                </span>
                Example 2 &middot; 22ms
              </div>
              <div className="flex items-center gap-2 opacity-70">
                <span className="grid size-4 place-items-center rounded-sm border-2 border-border bg-accent-red text-black">
                  <X className="size-2.5" strokeWidth={4} />
                </span>
                Hidden 7 &middot; Wrong Answer
              </div>
            </div>
          </div>

          {/* videos */}
          <div className="flex flex-col gap-2 bg-dots p-2">
            {[
              ["Sam", "bg-accent-blue", "Candidate"],
              ["You", "bg-main", "Interviewer"],
            ].map(([n, c, r]) => (
              <div key={n} className="relative aspect-[4/3] overflow-hidden rounded-base border-2 border-border bg-neutral-800">
                <div className={`absolute inset-0 grid place-items-center`}>
                  <span className={`grid size-9 place-items-center rounded-full border-2 border-border text-xs font-heading text-black ${c}`}>
                    {n[0]}
                  </span>
                </div>
                <span className="absolute bottom-1 left-1 rounded-sm border border-border bg-secondary-background px-1 text-[9px] font-heading">
                  {n} &middot; {r}
                </span>
              </div>
            ))}
            <div className="mt-auto flex justify-center gap-1">
              {[Mic, Video, MonitorUp].map((I, i) => (
                <span key={i} className="grid size-6 place-items-center rounded-base border-2 border-border bg-secondary-background">
                  <I className="size-3" />
                </span>
              ))}
            </div>
            <div className="rounded-base border-2 border-border bg-accent-yellow py-1 text-center font-mono text-sm font-bold text-black">
              31:42
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
