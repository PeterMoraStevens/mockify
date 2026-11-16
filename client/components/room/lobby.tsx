"use client";

import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CameraOff,
  Check,
  Copy,
  Link2,
  Mic,
  MicOff,
  RefreshCw,
  PenTool,
  UserPlus,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  acquireMedia,
  audioContext,
  blackVideoTrack,
  isSynthetic,
  listDevices,
  loadDevicePrefs,
  loadMediaToggles,
  saveDevicePrefs,
  saveMediaToggles,
  stopStream,
  type DevicePrefs,
} from "@/lib/room/media";
import { cn } from "@/lib/utils";
import type { RoomMode } from "@/lib/rooms";
import { InviteDialog } from "./invite-dialog";
import type { JoinedState, RoomUser } from "./room";

type Config = JoinedState["config"] & { turnError?: string };

export function Lobby({
  roomId,
  user,
  onJoin,
  mode = "coding",
}: {
  roomId: string;
  user: RoomUser;
  onJoin: (j: JoinedState) => void;
  mode?: RoomMode;
}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errors, setErrors] = useState<{ audio: string | null; video: string | null }>({ audio: null, video: null });
  const [devices, setDevices] = useState<{ audio: MediaDeviceInfo[]; video: MediaDeviceInfo[] }>({ audio: [], video: [] });
  const [prefs, setPrefs] = useState<DevicePrefs>(loadDevicePrefs);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [config, setConfig] = useState<Config | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [acquiring, setAcquiring] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handedOff = useRef(false);

  // Start with the mic/camera choice from last time (read after mount: no localStorage on the server).
  useEffect(() => {
    const t = loadMediaToggles();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage after mount
    setMicOn(t.micOn);
    setCamOn(t.camOn);
  }, []);

  // Callers flip `acquiring` on first; it starts true for the initial grab.
  const acquire = useCallback(async (p: DevicePrefs) => {
    stopStream(streamRef.current);
    const r = await acquireMedia(p);
    streamRef.current = r.stream;
    setStream(r.stream);
    setErrors({ audio: r.audioError, video: r.videoError });
    setDevices(await listDevices());
    setAcquiring(false);
  }, []);

  useEffect(() => {
    // acquire() only sets state after awaiting getUserMedia, i.e. from the external system's callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    acquire(loadDevicePrefs());
    return () => {
      if (!handedOff.current) stopStream(streamRef.current);
    };
  }, [acquire]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/turn?room=${roomId}`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
        if (!cancelled) setConfig({ roomId, ...body });
      })
      .catch((e) => !cancelled && setConfigError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const changeDevice = (kind: "audioId" | "videoId", id: string) => {
    const p = { ...prefs, [kind]: id };
    setPrefs(p);
    saveDevicePrefs(p);
    setAcquiring(true);
    acquire(p);
  };

  const join = () => {
    if (!stream || !config) return;
    handedOff.current = true;
    const audio = stream.getAudioTracks()[0];
    if (audio) audio.enabled = micOn && !isSynthetic(audio);
    if (!camOn) {
      const v = stream.getVideoTracks()[0];
      if (v && !isSynthetic(v)) {
        v.stop();
        stream.removeTrack(v);
        stream.addTrack(blackVideoTrack());
      }
    }
    // Resume the shared AudioContext inside a user gesture.
    audioContext().resume().catch(() => {});
    onJoin({ stream, prefs, micOn, camOn, config });
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Room link copied. Send it to the other person.");
  };

  const roomHref = useSyncExternalStore(
    () => () => {},
    () => window.location.href,
    () => `/room/${roomId}`,
  );

  const audioTrack = stream?.getAudioTracks()[0];
  const videoTrack = stream?.getVideoTracks()[0];
  const hasCam = !!videoTrack && !isSynthetic(videoTrack);
  const hasMic = !!audioTrack && !isSynthetic(audioTrack);

  return (
    <div className="min-h-screen bg-grid">
      <header className="flex h-16 items-center gap-4 border-b-4 border-border bg-secondary-background px-4">
        <Logo />
        <div className="ml-auto">
          <ModeToggle />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1.4fr_1fr]">
        {/* preview */}
        <section>
          <div className="relative aspect-video overflow-hidden rounded-base border-4 border-border bg-neutral-900 shadow-xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn("size-full -scale-x-100 object-cover", (!camOn || !hasCam) && "invisible")}
            />
            {(!camOn || !hasCam) && (
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center text-white">
                  <div className="mx-auto grid size-20 place-items-center rounded-full border-4 border-border bg-main font-heading text-3xl text-black">
                    {user.displayName[0]?.toUpperCase()}
                  </div>
                  <p className="mt-3 font-heading">{hasCam ? "Camera is off" : errors.video ?? "No camera"}</p>
                </div>
              </div>
            )}
            {acquiring && (
              <div className="absolute inset-0 grid place-items-center bg-black/50 text-white">
                <Spinner />
              </div>
            )}
            <div className="absolute bottom-3 left-3 rounded-base border-2 border-border bg-secondary-background px-2 py-0.5 text-sm font-heading">
              {user.displayName}
            </div>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-3">
              <RoundToggle on={micOn && hasMic} disabled={!hasMic} onClick={() => {
                  setMicOn(!micOn);
                  saveMediaToggles({ micOn: !micOn, camOn });
                }} label="microphone">
                {micOn && hasMic ? <Mic /> : <MicOff />}
              </RoundToggle>
              <RoundToggle on={camOn && hasCam} disabled={!hasCam} onClick={() => {
                  setCamOn(!camOn);
                  saveMediaToggles({ micOn, camOn: !camOn });
                }} label="camera">
                {camOn && hasCam ? <Camera /> : <CameraOff />}
              </RoundToggle>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <DevicePicker
              label="Microphone"
              icon={<Mic />}
              devices={devices.audio}
              value={prefs.audioId ?? audioTrack?.getSettings().deviceId}
              onChange={(id) => changeDevice("audioId", id)}
            />
            <DevicePicker
              label="Camera"
              icon={<Camera />}
              devices={devices.video}
              value={prefs.videoId ?? videoTrack?.getSettings().deviceId}
              onChange={(id) => changeDevice("videoId", id)}
            />
          </div>
          <div className="mt-4">
            <div className="mb-2 text-sm font-heading">Mic level: say something</div>
            <LevelMeter track={hasMic && micOn ? audioTrack! : null} />
          </div>
        </section>

        {/* checklist + join */}
        <section className="flex flex-col gap-5">
          <div className="rounded-base border-4 border-border bg-secondary-background p-6 shadow-xl">
            {mode === "design" && (
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-base border-2 border-border bg-accent-blue px-2 py-0.5 text-xs font-heading uppercase tracking-wider text-black">
                <PenTool className="size-3.5" /> System design: whiteboard only
              </div>
            )}
            <h1 className="text-3xl">Ready to join?</h1>
            <p className="mt-2 text-sm text-muted">
              Check your camera and mic first so you don&apos;t spend the first five minutes asking &ldquo;can you hear me?&rdquo;
            </p>
            <ul className="mt-6 space-y-3">
              <CheckRow ok={hasCam} warn={!hasCam} label="Camera" detail={hasCam ? "Working" : errors.video ?? "Not found"} />
              <CheckRow ok={hasMic} warn={!hasMic} label="Microphone" detail={hasMic ? "Working" : errors.audio ?? "Not found"} />
            </ul>
            {(errors.audio || errors.video) && (
              <Button
                variant="neutral"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setAcquiring(true);
                  acquire(prefs);
                }}
              >
                <RefreshCw /> Try devices again
              </Button>
            )}
            <Button onClick={join} disabled={!stream || !config || acquiring} className="mt-6 h-14 w-full text-base font-heading">
              {!config && !configError ? <Spinner /> : null}
              Join interview <ArrowRight />
            </Button>
            {configError && <p className="mt-3 text-sm text-accent-red">Couldn&apos;t reach the room: {configError}</p>}
          </div>

          <div className="rounded-base border-2 border-border bg-accent-yellow p-5 text-black shadow-lg">
            <div className="flex items-center gap-2 font-heading">
              <Link2 className="size-5" /> Invite the other person
            </div>
            <p className="mt-1 text-sm">Invite a friend directly, or send the link. Anyone with it (and an account) can join. Rooms hold two people.</p>
            <Button variant="neutral" className="mt-3 w-full" onClick={() => setInviteOpen(true)}>
              <UserPlus /> Invite a friend
            </Button>
            <div className="mt-3 flex gap-2">
              <code className="min-w-0 flex-1 truncate rounded-base border-2 border-border bg-secondary-background px-2 py-2 font-mono text-xs text-foreground">
                {roomHref}
              </code>
              <Button variant="neutral" size="icon" onClick={copyLink} aria-label="Copy room link">
                <Copy />
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-base border-2 border-dashed border-border p-4 text-sm text-muted">
            <ShieldCheck className="mt-0.5 size-5 shrink-0" />
            Video, audio and the editor go straight to the other browser. Nothing is recorded or stored on the server.
          </div>
        </section>
      </main>
      <InviteDialog roomId={roomId} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}

function RoundToggle({
  on,
  disabled,
  onClick,
  label,
  children,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={`Turn ${label} ${on ? "off" : "on"}`}
      aria-pressed={on}
      className={cn(
        "grid size-12 place-items-center rounded-full border-2 border-border shadow-shadow transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none disabled:opacity-50 [&_svg]:size-5",
        on ? "bg-secondary-background text-foreground" : "bg-accent-red text-black",
      )}
    >
      {children}
    </button>
  );
}

function DevicePicker({
  label,
  icon,
  devices,
  value,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  devices: MediaDeviceInfo[];
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  const known = devices.some((d) => d.deviceId === value);
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-heading [&_svg]:size-4">
        {icon} {label}
      </div>
      <Select value={known ? value : ""} onValueChange={onChange} disabled={devices.length === 0}>
        <SelectTrigger className="bg-secondary-background text-foreground shadow-shadow">
          <SelectValue placeholder={devices.length ? "Default" : "None found"} />
        </SelectTrigger>
        <SelectContent className="z-100">
          {devices.map((d, i) => (
            <SelectItem key={d.deviceId} value={d.deviceId}>
              {d.label || `${label} ${i + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function LevelMeter({ track }: { track: MediaStreamTrack | null }) {
  const [rawLevel, setLevel] = useState(0);
  const level = track ? rawLevel : 0;
  useEffect(() => {
    if (!track) return;
    const ctx = audioContext();
    ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(new MediaStream([track]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let raf = 0;
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      setLevel((prev) => Math.max(Math.min(1, rms * 4), prev * 0.85));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      src.disconnect();
    };
  }, [track]);

  const SEGMENTS = 20;
  const lit = Math.round(level * SEGMENTS);
  return (
    <div className="flex h-6 gap-1 rounded-base border-2 border-border bg-secondary-background p-1">
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={cn(
            "flex-1 rounded-[2px] transition-colors duration-75",
            i < lit ? (i > SEGMENTS * 0.8 ? "bg-accent-red" : i > SEGMENTS * 0.55 ? "bg-accent-yellow" : "bg-accent-green") : "bg-background",
          )}
        />
      ))}
    </div>
  );
}

function CheckRow({
  ok,
  warn,
  error,
  pending,
  label,
  detail,
}: {
  ok?: boolean;
  warn?: boolean;
  error?: boolean;
  pending?: boolean;
  label: string;
  detail: string;
}) {
  const tone = error ? "bg-accent-red" : ok ? "bg-accent-green" : warn ? "bg-accent-yellow" : "bg-background";
  return (
    <li className="flex items-center gap-3">
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-base border-2 border-border text-black", tone)}>
        {pending ? <Spinner /> : ok ? <Check className="size-4" strokeWidth={3} />  : <AlertTriangle className="size-4" />}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-heading">{label}</div>
        <div className="truncate text-xs text-muted">{detail}</div>
      </div>
    </li>
  );
}
