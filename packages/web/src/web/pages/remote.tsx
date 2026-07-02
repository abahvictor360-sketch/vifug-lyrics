import { useEffect, useState } from "react";
import {
  ChevronLeft, ChevronRight, Square, Ban, SendHorizontal, Wifi, WifiOff,
} from "lucide-react";
import type { LiveState } from "../lib/live-bus";
import { IDLE_STATE, DEFAULT_THEME } from "../lib/live-bus";

/**
 * Phone / tablet remote.
 *
 * Sends fire-and-forget commands to the operator via /api/remote/command; the
 * operator (single source of truth, manual override always wins) executes them.
 * Also subscribes to the live SSE feed so the remote shows what is on screen.
 *
 * Open on a phone on the same network at:  <app-url>/#/remote
 */
async function sendCommand(action: string) {
  try {
    await fetch("/api/remote/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
  } catch {
    /* ignore */
  }
}

export default function RemotePage() {
  const [state, setState] = useState<LiveState>(IDLE_STATE);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    document.title = "Vifug Remote";
    let es: EventSource | null = null;
    let stopped = false;
    const connect = () => {
      if (stopped) return;
      es = new EventSource("/api/live/stream");
      es.addEventListener("live", (e) => {
        setOnline(true);
        try {
          const raw = JSON.parse((e as MessageEvent).data) as Partial<LiveState>;
          setState({ ...IDLE_STATE, ...raw, theme: { ...DEFAULT_THEME, ...(raw.theme ?? {}) } } as LiveState);
        } catch {
          /* ignore */
        }
      });
      es.onerror = () => {
        setOnline(false);
        es?.close();
        if (!stopped) setTimeout(connect, 1500);
      };
    };
    connect();
    return () => {
      stopped = true;
      es?.close();
    };
  }, []);

  const Btn = ({
    onClick,
    children,
    className = "",
  }: {
    onClick: () => void;
    children: React.ReactNode;
    className?: string;
  }) => (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-2xl font-semibold text-white transition-transform active:scale-95 ${className}`}
    >
      {children}
    </button>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0a0a0c] p-4 text-white">
      {/* Status */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-lg font-bold">Vifug Remote</span>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            online ? "bg-emerald-500/15 text-emerald-400" : "bg-white/10 text-white/40"
          }`}
        >
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {online ? "Connected" : "Offline"}
        </span>
      </div>

      {/* Live preview */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-black p-4">
        <div className="mb-1 text-xs uppercase tracking-widest text-[color:#f5c518]">
          {state.status === "live"
            ? state.sectionLabel || "Live"
            : state.status === "blank"
              ? "Blanked"
              : "Nothing live"}
        </div>
        <div className="min-h-[4.5rem]">
          {state.status === "live" ? (
            state.sourceLines.map((l, i) => (
              <div key={i} className="font-lyric text-xl font-semibold leading-snug">
                {l}
              </div>
            ))
          ) : (
            <div className="text-white/30">—</div>
          )}
        </div>
        {state.slideCount > 0 && state.status === "live" && (
          <div className="mt-2 text-xs text-white/40">
            Slide {state.slideIndex + 1} / {state.slideCount}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="grid flex-1 grid-cols-2 gap-3">
        <Btn onClick={() => sendCommand("prev")} className="bg-white/10 text-2xl">
          <ChevronLeft className="h-7 w-7" /> Prev
        </Btn>
        <Btn onClick={() => sendCommand("next")} className="bg-white/10 text-2xl">
          Next <ChevronRight className="h-7 w-7" />
        </Btn>
        <Btn
          onClick={() => sendCommand("sendLive")}
          className="col-span-2 bg-emerald-600 py-6 text-2xl"
        >
          <SendHorizontal className="h-7 w-7" /> Send Preview → Live
        </Btn>
        <Btn onClick={() => sendCommand("blank")} className="bg-blue-600/80 py-6 text-xl">
          <Square className="h-6 w-6" /> Blank
        </Btn>
        <Btn onClick={() => sendCommand("clear")} className="bg-red-600/80 py-6 text-xl">
          <Ban className="h-6 w-6" /> Clear
        </Btn>
      </div>

      <p className="mt-3 text-center text-xs text-white/30">
        Prev / Next cue slides · Send pushes preview to live
      </p>
    </div>
  );
}
