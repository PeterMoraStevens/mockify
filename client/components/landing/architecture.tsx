import { cn } from "@/lib/utils";

/**
 * Neo-brutalist take on the deployment diagram. Lines are one SVG in a
 * 1000×640 coordinate space; boxes are HTML positioned in the same space by %.
 */

const W = 1000;
const H = 640;

type BoxProps = {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  className?: string;
};

function Box({ x, y, w, h, title, sub, className }: BoxProps) {
  return (
    <div
      className={cn(
        "absolute flex flex-col items-center justify-center rounded-base border-2 border-border text-center shadow-lg",
        className,
      )}
      style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, width: `${(w / W) * 100}%`, height: `${(h / H) * 100}%` }}
    >
      <div className="font-heading text-base lg:text-lg">{title}</div>
      {sub && <div className="text-xs font-base opacity-80 lg:text-sm">{sub}</div>}
    </div>
  );
}

export function ArchitectureDiagram() {
  return (
    <>
      <div className="relative mt-12 hidden w-full md:block" style={{ aspectRatio: `${W} / ${H}` }}>
        {/* Homelab container sits under everything */}
        <div
          className="absolute rounded-[14px] border-2 border-border bg-accent-violet/35 shadow-xl"
          style={{ left: "2%", top: `${(400 / H) * 100}%`, width: "96%", height: `${(225 / H) * 100}%` }}
        >
          <span className="absolute left-4 top-3 rounded-base border-2 border-border bg-accent-violet px-2 py-0.5 text-sm font-heading text-black">
            Homelab
          </span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full text-foreground" aria-hidden>
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
            </marker>
          </defs>
          <g stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round">
            {/* direct P2P */}
            <path d="M285 65 H715" markerStart="url(#arr)" markerEnd="url(#arr)" />
            {/* browsers → tunnel */}
            <path d="M80 110 V282" markerEnd="url(#arr)" />
            <path d="M920 110 V282" markerEnd="url(#arr)" />
            {/* tunnel → app, peer server */}
            <path d="M190 360 V452" markerEnd="url(#arr)" />
            <path d="M500 360 V452" markerEnd="url(#arr)" />
            {/* app → piston over LAN */}
            <path d="M190 550 V588 H810 V558" markerEnd="url(#arr)" />
          </g>
          <g stroke="currentColor" strokeWidth="2.5" fill="none" strokeDasharray="8 7" opacity="0.75">
            <path d="M210 110 V195 H347" markerEnd="url(#arr)" />
            <path d="M790 110 V195 H653" markerEnd="url(#arr)" />
          </g>
        </svg>

        <div
          className="absolute -translate-x-1/2 rounded-base border-2 border-border bg-accent-green px-3 py-1 text-xs font-heading uppercase tracking-wide text-black shadow-shadow lg:text-sm"
          style={{ left: "50%", top: `${(20 / H) * 100}%` }}
        >
          Direct WebRTC: A/V + editor
        </div>
        <div
          className="absolute -translate-x-1/2 rounded-base border-2 border-border bg-secondary-background px-2 py-0.5 text-[11px] font-heading uppercase tracking-wide shadow-shadow"
          style={{ left: "50%", top: `${(570 / H) * 100}%` }}
        >
          LAN only
        </div>

        <Box x={20} y={20} w={265} h={90} title="Browser A" sub="PeerJS slot a" className="bg-secondary-background" />
        <Box x={715} y={20} w={265} h={90} title="Browser B" sub="PeerJS slot b" className="bg-secondary-background" />
        <Box x={350} y={150} w={300} h={90} title="Cloudflare TURN" sub="Fallback relay only" className="bg-main text-main-foreground" />
        <Box
          x={20}
          y={285}
          w={960}
          h={75}
          title="Cloudflare tunnel (HTTPS + WebSocket)"
          className="bg-main text-main-foreground"
        />
        <Box x={60} y={455} w={260} h={95} title="Next.js app" sub="UI, TURN creds, runs" className="bg-secondary-background" />
        <Box x={370} y={455} w={260} h={95} title="PeerJS server" sub="Signaling only" className="bg-secondary-background" />
        <Box x={680} y={455} w={260} h={95} title="Piston" sub="LAN only, no tunnel" className="bg-accent-yellow text-black" />
      </div>

      {/* Stacked version for narrow screens */}
      <ol className="mt-10 space-y-3 md:hidden">
        {[
          ["Browser A ⇄ Browser B", "Direct WebRTC for video, audio and the editor", "bg-accent-green text-black"],
          ["Cloudflare TURN", "Relay used only when a direct path fails", "bg-main text-main-foreground"],
          ["Cloudflare tunnel", "HTTPS + WebSocket into the homelab", "bg-main text-main-foreground"],
          ["Next.js app", "UI, TURN credentials, code runs", "bg-secondary-background"],
          ["PeerJS server", "Signaling only", "bg-secondary-background"],
          ["Piston", "LAN only, never exposed", "bg-accent-yellow text-black"],
        ].map(([t, s, c]) => (
          <li key={t} className={cn("rounded-base border-2 border-border p-4 shadow-shadow", c)}>
            <div className="font-heading">{t}</div>
            <div className="text-sm opacity-80">{s}</div>
          </li>
        ))}
      </ol>
    </>
  );
}
