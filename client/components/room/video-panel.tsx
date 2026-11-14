"use client";

import { Camera, CameraOff, Copy, Mic, MicOff, MonitorUp, MonitorX, PhoneOff, UserRound } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import type { ConnSnapshot } from "@/lib/room/connection";
import type { PresenceState, Role } from "@/lib/room/session-doc";
import { cn } from "@/lib/utils";

export function VideoPanel({
  snap,
  localTrack,
  localName,
  localRole,
  remote,
  remoteRole,
  micOn,
  camOn,
  sharing,
  onMic,
  onCam,
  onShare,
  onLeave,
  compact,
}: {
  snap: ConnSnapshot;
  localTrack: MediaStreamTrack | null;
  localName: string;
  localRole: Role | null;
  remote: PresenceState | null;
  remoteRole: Role | null;
  micOn: boolean;
  camOn: boolean;
  sharing: boolean;
  onMic: () => void;
  onCam: () => void;
  onShare: () => void;
  onLeave: () => void;
  compact: boolean;
}) {
  const remoteHere = snap.status === "connected" && !!remote;

  return (
    <aside className={cn("flex h-full min-h-0 flex-col gap-3", compact && "h-auto")}>
      <div className={cn("flex min-h-0 flex-col gap-3", compact ? "grid grid-cols-2" : "flex-1 overflow-y-auto scrollbar-thin")}>
        {remoteHere ? (
          <Tile
            stream={snap.remoteStream}
            name={remote.user.name}
            role={remoteRole}
            muted={remote.muted}
            videoOff={remote.cameraOff && !remote.sharing}
            sharing={remote.sharing}
            color={remote.user.color}
          />
        ) : (
          <WaitingTile status={snap.status} />
        )}
        <Tile
          track={localTrack}
          name={`${localName} (you)`}
          role={localRole}
          muted={!micOn}
          videoOff={!camOn && !sharing}
          sharing={sharing}
          mirror={!sharing}
          local
        />
      </div>

      <div className="flex items-center justify-center gap-2 rounded-base border-2 border-border bg-secondary-background p-2 shadow-lg">
        <CtrlButton on={micOn} onClick={onMic} label={micOn ? "Mute" : "Unmute"}>
          {micOn ? <Mic /> : <MicOff />}
        </CtrlButton>
        <CtrlButton on={camOn} onClick={onCam} label={camOn ? "Turn camera off" : "Turn camera on"}>
          {camOn ? <Camera /> : <CameraOff />}
        </CtrlButton>
        <CtrlButton on={!sharing} active={sharing} onClick={onShare} label={sharing ? "Stop sharing" : "Share screen"}>
          {sharing ? <MonitorX /> : <MonitorUp />}
        </CtrlButton>
        <CtrlButton on={false} onClick={onLeave} label="Leave" danger>
          <PhoneOff />
        </CtrlButton>
      </div>
    </aside>
  );
}

function Tile({
  stream,
  track,
  name,
  role,
  muted,
  videoOff,
  sharing,
  mirror,
  local,
  color,
}: {
  stream?: MediaStream | null;
  track?: MediaStreamTrack | null;
  name: string;
  role: Role | null;
  muted: boolean;
  videoOff: boolean;
  sharing: boolean;
  mirror?: boolean;
  local?: boolean;
  color?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const src = stream ?? (track ? new MediaStream([track]) : null);
    if (v.srcObject !== src) v.srcObject = src;
    if (src) v.play().catch(() => {});
  }, [stream, track]);

  return (
    <div
      className={cn(
        "relative aspect-video shrink-0 overflow-hidden rounded-base border-2 border-border bg-neutral-900 shadow-lg",
        sharing && !local && "aspect-auto min-h-48 flex-1",
      )}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={local}
        className={cn(
          "size-full",
          sharing ? "object-contain" : "object-cover",
          mirror && "-scale-x-100",
          videoOff && "invisible",
        )}
      />
      {videoOff && (
        <div className="absolute inset-0 grid place-items-center">
          <span
            className="grid size-14 place-items-center rounded-full border-2 border-border font-heading text-xl text-black"
            style={{ background: color ?? "var(--main)" }}
          >
            {name.replace(" (you)", "")[0]?.toUpperCase() ?? <UserRound />}
          </span>
        </div>
      )}
      <div className="absolute inset-x-1.5 bottom-1.5 flex items-center gap-1.5">
        <span className="min-w-0 truncate rounded-sm border-2 border-border bg-secondary-background px-1.5 text-xs font-heading">
          {name}
        </span>
        {role && (
          <span
            className={cn(
              "rounded-sm border-2 border-border px-1 text-[10px] font-heading uppercase text-black",
              role === "interviewer" ? "bg-accent-violet" : "bg-accent-blue",
            )}
          >
            {role}
          </span>
        )}
        {muted && (
          <span className="ml-auto grid size-6 place-items-center rounded-sm border-2 border-border bg-accent-red text-black">
            <MicOff className="size-3.5" />
          </span>
        )}
      </div>
      {sharing && (
        <span className="absolute left-1.5 top-1.5 rounded-sm border-2 border-border bg-accent-green px-1 text-[10px] font-heading uppercase text-black">
          Screen
        </span>
      )}
    </div>
  );
}

function WaitingTile({ status }: { status: ConnSnapshot["status"] }) {
  const copy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Room link copied");
  };
  const connecting = status === "connecting" || status === "reconnecting" || status === "signaling" || status === "init";
  return (
    <div className="relative grid aspect-video shrink-0 place-items-center overflow-hidden rounded-base border-2 border-dashed border-border bg-background bg-dots p-3 text-center">
      <div>
        <div className="mx-auto grid size-12 place-items-center rounded-full border-2 border-border bg-secondary-background">
          {connecting ? <Spinner /> : <UserRound className="size-6" />}
        </div>
        <div className="mt-2 text-sm font-heading">
          {status === "reconnecting" ? "Reconnecting…" : connecting ? "Connecting…" : "Waiting for the other person"}
        </div>
        {status === "waiting" && (
          <button onClick={copy} className="mt-2 inline-flex items-center gap-1 text-xs font-heading underline underline-offset-4">
            <Copy className="size-3" /> Copy invite link
          </button>
        )}
      </div>
    </div>
  );
}

function CtrlButton({
  on,
  active,
  danger,
  onClick,
  label,
  children,
}: {
  on: boolean;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "grid size-11 place-items-center rounded-full border-2 border-border shadow-shadow transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none [&_svg]:size-5",
        danger
          ? "bg-accent-red text-black"
          : active
            ? "bg-accent-green text-black"
            : on
              ? "bg-secondary-background"
              : "bg-accent-red text-black",
      )}
    >
      {children}
    </button>
  );
}
