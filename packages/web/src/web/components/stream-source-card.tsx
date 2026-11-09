import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { AppSettings } from "../hooks/use-settings";

/**
 * The address OBS (or vMix, or any browser source) loads to get Vifug's
 * transparent overlay, and how that overlay sits inside the source.
 *
 * This is set up once, before a service, and then left alone - so it lives in
 * Settings > Streaming & output rather than in the operator's rail, which is
 * for what a desk reaches for during the service. The Audio Mixer, which is
 * used live, stays there.
 */
export function StreamSourceCard({
  settings,
  patchSettings,
}: {
  settings: AppSettings | undefined;
  patchSettings: (patch: Partial<AppSettings>) => void;
}) {
  const [copied, setCopied] = useState(false);
  const streamUrl = typeof window !== "undefined" ? `${window.location.origin}/#/stream` : "/#/stream";

  const setStream = (patch: Partial<NonNullable<AppSettings["stream"]>>) =>
    patchSettings({
      stream: {
        // Spread the whole existing block first: a settings patch replaces
        // `stream` wholesale, so listing fields by hand would reset siblings.
        ...settings?.stream,
        canvas: settings?.stream?.canvas ?? "1920x1080",
        fps: settings?.stream?.fps ?? 30,
        bitrateKbps: settings?.stream?.bitrateKbps ?? 4500,
        encoder: settings?.stream?.encoder ?? "x264",
        ...patch,
      },
    });

  return (
    <div>
      <div className="flex gap-1.5">
        <input
          readOnly
          value={streamUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-md border border-[var(--v-border)] bg-[var(--v-surface-2)] px-2 py-1.5 text-[12px] outline-none"
        />
        <button
          onClick={() => {
            navigator.clipboard?.writeText(streamUrl).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            });
          }}
          aria-label={copied ? "Stream address copied" : "Copy the stream address"}
          className="rounded-md border border-[var(--v-border)] bg-[var(--v-surface-2)] px-2 hover:bg-[var(--v-surface-3)] focus-visible:ring-2 focus-visible:ring-[var(--v-accent)] focus-visible:outline-none"
        >
          {copied ? <Check className="h-4 w-4 text-[var(--v-ok)]" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-[var(--v-text-faint)]">
        Add as an OBS <b>Browser</b> source (transparent). For NDI, route this browser source out via OBS + the NDI plugin.
      </p>
      <a
        href="/#/stream"
        target="_blank"
        rel="noreferrer"
        className="mt-1.5 -ml-1 inline-flex h-7 items-center rounded px-1 text-[12px] font-medium text-[var(--v-accent)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--v-accent)] focus-visible:outline-none"
      >
        Open stream output ↗
      </a>

      {/* How the overlay sits inside the browser source. "Fill" is right for
          almost everyone - OBS makes browser sources 800x600 by default, and
          letterboxing a 16:9 overlay inside that is what makes the lyrics
          look far too small. */}
      <div className="mt-2 flex gap-1.5">
        {([
          { id: "fill", label: "Fill source" },
          { id: "canvas", label: "Fixed canvas" },
        ] as const).map((o) => (
          <button
            key={o.id}
            onClick={() => setStream({ fitMode: o.id })}
            title={
              o.id === "fill"
                ? "The overlay fills whatever size the browser source is"
                : `Lay out at ${settings?.stream?.canvas ?? "1920x1080"} and letterbox to fit`
            }
            className={`flex-1 rounded-md border px-2 py-1 text-[12px] transition-colors ${
              (settings?.stream?.fitMode ?? "fill") === o.id
                ? "border-[var(--v-accent)] bg-[var(--v-accent-soft)] text-[var(--v-accent)]"
                : "border-[var(--v-border)] hover:bg-[var(--v-surface-3)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
