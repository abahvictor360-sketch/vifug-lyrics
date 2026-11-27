import { useEffect, useRef, useState } from "react";
import { Camera, MonitorUp, RefreshCw, Mic, MicOff, Square, Loader2 } from "lucide-react";
import { useWakeLock } from "../hooks/use-wake-lock";
import { startCastSender, type CastSender } from "../lib/cast";

/**
 * The page a phone (or another computer) opens to send its camera or screen
 * to Vifug. Reached by scanning the QR code in Vifug's capture picker:
 *
 *   <app>/#/cast?room=<code>
 *
 * Nothing is recorded or uploaded: the picture goes straight to the Vifug
 * screens over the local network (WebRTC). Closing this page ends it.
 */
/** Opened from the "use my phone as the microphone" link: audio only, microphone first. */
function micOnlyFromHash(): boolean {
  const h = window.location.hash;
  const q = h.indexOf("?");
  return q !== -1 && new URLSearchParams(h.slice(q + 1)).get("mic") === "1";
}

function roomFromHash(): string {
  const h = window.location.hash;
  const q = h.indexOf("?");
  return q === -1 ? "" : (new URLSearchParams(h.slice(q + 1)).get("room") ?? "");
}

export default function CastPage() {
  const room = roomFromHash();
  const micOnly = micOnlyFromHash();
  const [kind, setKind] = useState<"camera" | "screen" | "mic" | null>(null);
  const [level, setLevel] = useState(0);
  const meter = useRef<{ ctx: AudioContext; timer: ReturnType<typeof setInterval> } | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [mic, setMic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewers, setViewers] = useState(0);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sender = useRef<CastSender | null>(null);
  const canShare = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
  const secure = typeof window !== "undefined" && window.isSecureContext;
  // A phone that sleeps stops sending, and a microphone that goes quiet mid-sermon is the worst case.
  useWakeLock(kind !== null);

  function stopMeter() {
    if (meter.current) {
      clearInterval(meter.current.timer);
      void meter.current.ctx.close().catch(() => {});
      meter.current = null;
    }
    setLevel(0);
  }

  function stop() {
    stopMeter();
    sender.current?.stop();
    sender.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setKind(null);
    setViewers(0);
  }

  async function start(what: "camera" | "screen" | "mic", face = facing) {
    if (!/^[a-z0-9]{6,16}$/.test(room)) {
      setError("This link has no connection code. Scan the QR code in Vifug again.");
      return;
    }
    setError(null);
    setBusy(true);
    sender.current?.stop();
    try {
      const stream =
        what === "mic"
          ? await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
              video: false,
            })
          : what === "camera"
          ? await navigator.mediaDevices.getUserMedia({
              video: { facingMode: face, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
              audio: mic ? { echoCancellation: true, noiseSuppression: true } : false,
            })
          : await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: mic });
      (what === "mic" ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0])?.addEventListener("ended", stop);
      if (what === "mic") {
        // Only to show the person holding the phone that it is hearing them.
        stopMeter();
        try {
          const ctx = new AudioContext();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          ctx.createMediaStreamSource(stream).connect(analyser);
          const buf = new Uint8Array(analyser.fftSize);
          meter.current = {
            ctx,
            timer: setInterval(() => {
              analyser.getByteTimeDomainData(buf);
              let peak = 0;
              for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
              setLevel(Math.min(1, peak / 64));
            }, 100),
          };
        } catch {
          /* no meter; it still sends */
        }
      } else if (videoRef.current) videoRef.current.srcObject = stream;
      sender.current = startCastSender(room, stream, setViewers);
      setKind(what);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? what === "mic"
            ? "Permission was refused. Allow the microphone in your browser and try again."
            : "Permission was refused. Allow the camera (or screen) in your browser and try again."
          : what === "mic"
            ? "Couldn't start the microphone. Another app may be using it."
            : "Couldn't start that. Another app may be using the camera.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => () => { stopMeter(); sender.current?.stop(); }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-3 bg-[var(--v-bg,#0a0a0c)] p-4 text-white">
      <h1 className="text-lg font-semibold">{micOnly ? "Use this phone as the microphone" : "Send to Vifug"}</h1>
      <div className={`relative overflow-hidden rounded-lg bg-black ${micOnly ? "h-28" : "aspect-video"}`}>
        {!micOnly && <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />}
        {micOnly && kind === "mic" && (
          <div className="absolute inset-x-4 bottom-4 h-3 overflow-hidden rounded-full bg-white/10" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
            <div className="h-full rounded-full bg-lime-400 transition-[width] duration-100" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
        )}
        {!kind && <p className="absolute inset-0 grid place-items-center text-sm text-white/50">{micOnly ? "The microphone is off" : "Nothing is being sent"}</p>}
        {kind && (
          <span className="absolute left-2 top-2 rounded bg-red-600 px-2 py-0.5 text-[11px] font-bold">
            {viewers > 0 ? (kind === "mic" ? "SENDING TO VIFUG" : `LIVE to ${viewers} screen${viewers === 1 ? "" : "s"}`) : "WAITING FOR VIFUG"}
          </span>
        )}
      </div>

      {!secure && (
        <p className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs text-amber-300">
          This page is not secure (https), so the browser will not allow the camera. Scan the QR code from Vifug again - it opens the secure address.
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!kind && micOnly ? (
        <div className="flex flex-col gap-2">
          <button
            disabled={busy}
            onClick={() => void start("mic")}
            className="flex items-center justify-center gap-2 rounded-lg bg-lime-400 py-4 text-lg font-semibold text-black disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />} Send my microphone
          </button>
          <p className="text-xs text-white/60">
            AI auto-follow in Vifug will listen through this phone. Put it near the speaker or the room, keep this page open
            and the screen on, and stay on the same Wi-Fi if you can.
          </p>
        </div>
      ) : !kind ? (
        <div className="flex flex-col gap-2">
          <button
            disabled={busy}
            onClick={() => void start("camera")}
            className="flex items-center justify-center gap-2 rounded-lg bg-lime-400 py-3 text-base font-semibold text-black disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />} Send my camera
          </button>
          {canShare && (
            <button
              disabled={busy}
              onClick={() => void start("screen")}
              className="flex items-center justify-center gap-2 rounded-lg border border-white/20 py-3 text-base"
            >
              <MonitorUp className="h-5 w-5" /> Share this screen
            </button>
          )}
          <label className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm">
            <span className="flex items-center gap-2">{mic ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />} Send sound too</span>
            <input type="checkbox" checked={mic} onChange={(e) => setMic(e.target.checked)} />
          </label>
          <p className="text-xs text-white/50">Phones can send their camera; sharing a whole screen works from a computer.</p>
        </div>
      ) : (
        <div className="flex gap-2">
          {kind === "camera" && (
            <button
              onClick={() => {
                const next = facing === "user" ? "environment" : "user";
                setFacing(next);
                void start("camera", next);
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/20 py-3"
            >
              <RefreshCw className="h-5 w-5" /> Flip camera
            </button>
          )}
          <button onClick={stop} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-3 font-semibold">
            <Square className="h-5 w-5" /> Stop
          </button>
        </div>
      )}
      <p className="mt-auto text-center text-[11px] text-white/40">Keep this page open and the screen awake while you send.</p>
    </div>
  );
}
