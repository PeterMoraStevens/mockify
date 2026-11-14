"use client";

/**
 * The outgoing stream always has exactly one audio and one video track, even
 * without a camera or mic (we synthesize silent/black ones). That way mute,
 * camera toggle and screen share are all `replaceTrack` / `enabled` flips with
 * no WebRTC renegotiation.
 */

export type DevicePrefs = { audioId?: string; videoId?: string };

const PREFS_KEY = "mockify:devices";

export function loadDevicePrefs(): DevicePrefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function saveDevicePrefs(p: DevicePrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {}
}

const TOGGLES_KEY = "mockify:media-toggles";
export type MediaToggles = { micOn: boolean; camOn: boolean };

/** Last mic/camera on-off choice, so rejoining (or a new room) starts the same way. */
export function loadMediaToggles(): MediaToggles {
  try {
    const v = JSON.parse(localStorage.getItem(TOGGLES_KEY) ?? "{}");
    return { micOn: v.micOn !== false, camOn: v.camOn !== false };
  } catch {
    return { micOn: true, camOn: true };
  }
}

export function saveMediaToggles(t: MediaToggles) {
  try {
    localStorage.setItem(TOGGLES_KEY, JSON.stringify(t));
  } catch {}
}

export function blackVideoTrack(width = 640, height = 360): MediaStreamTrack {
  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, width, height);
  // Some browsers won't emit frames from a canvas that never repaints.
  const stream = canvas.captureStream(1);
  const track = stream.getVideoTracks()[0];
  const iv = window.setInterval(() => ctx.fillRect(0, 0, 1, 1), 1000);
  track.addEventListener("ended", () => window.clearInterval(iv));
  (track as MediaStreamTrack & { __synthetic?: boolean }).__synthetic = true;
  return track;
}

let sharedCtx: AudioContext | null = null;
export function audioContext(): AudioContext {
  sharedCtx ??= new AudioContext();
  return sharedCtx;
}

export function silentAudioTrack(): MediaStreamTrack {
  const ctx = audioContext();
  const dst = ctx.createMediaStreamDestination();
  const track = dst.stream.getAudioTracks()[0];
  track.enabled = false;
  (track as MediaStreamTrack & { __synthetic?: boolean }).__synthetic = true;
  return track;
}

export const isSynthetic = (t: MediaStreamTrack | undefined | null) =>
  !!(t as (MediaStreamTrack & { __synthetic?: boolean }) | null)?.__synthetic;

export type AcquireResult = {
  stream: MediaStream;
  audioError: string | null;
  videoError: string | null;
};

function describe(e: unknown): string {
  const name = (e as DOMException)?.name;
  if (name === "NotAllowedError") return "Permission denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No device found";
  if (name === "NotReadableError") return "Device is in use by another app";
  return (e as Error)?.message ?? "Unavailable";
}

/** Grab camera + mic separately so one failing doesn't take the other down. */
export async function acquireMedia(prefs: DevicePrefs): Promise<AcquireResult> {
  const stream = new MediaStream();
  let audioError: string | null = null;
  let videoError: string | null = null;

  const [a, v] = await Promise.allSettled([
    navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: prefs.audioId ? { exact: prefs.audioId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    }),
    navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: prefs.videoId ? { exact: prefs.videoId } : undefined,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
    }),
  ]);

  if (a.status === "fulfilled") stream.addTrack(a.value.getAudioTracks()[0]);
  else {
    audioError = describe(a.reason);
    stream.addTrack(silentAudioTrack());
  }
  if (v.status === "fulfilled") stream.addTrack(v.value.getVideoTracks()[0]);
  else {
    videoError = describe(v.reason);
    stream.addTrack(blackVideoTrack());
  }
  return { stream, audioError, videoError };
}

export async function listDevices() {
  const all = await navigator.mediaDevices.enumerateDevices();
  return {
    audio: all.filter((d) => d.kind === "audioinput" && d.deviceId),
    video: all.filter((d) => d.kind === "videoinput" && d.deviceId),
  };
}

export function stopStream(s: MediaStream | null | undefined) {
  s?.getTracks().forEach((t) => t.stop());
}
