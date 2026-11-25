import { MediaPicker } from "./media-picker";
import { DEFAULT_TIMER, DEFAULT_TIMER_BG, type ServiceTimer } from "../lib/timer";
import type { AppSettings } from "../hooks/use-settings";

const card = "rounded-xl border border-[var(--v-border)] bg-[var(--v-surface-2)] p-4";
const label = "mb-1.5 block text-[11px] uppercase tracking-wide text-[var(--v-text-faint)]";
const field =
  "w-full rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)] px-3 py-2 text-sm outline-none focus:border-[var(--v-accent)]";

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex-1 rounded-md border px-2 py-2 text-[13px] leading-tight transition-colors ${
        on
          ? "border-[var(--v-accent)] bg-[var(--v-accent-soft)] text-[var(--v-accent)]"
          : "border-[var(--v-border)] bg-[var(--v-surface-3)] text-[var(--v-text-dim)] hover:text-[var(--v-text)]"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Settings > Timer: everything about how the service timer looks and where it
 * shows. Starting it, its length and its position stay in the operator's
 * sidebar, since those are used mid-service; this is the set-and-forget part.
 */
export function TimerSettings({
  settings,
  patchSettings,
}: {
  settings: AppSettings | undefined;
  patchSettings: (p: Partial<AppSettings>) => void;
}) {
  const t: ServiceTimer = { ...DEFAULT_TIMER, ...(settings?.timer ?? {}) };
  const set = (patch: Partial<ServiceTimer>) => patchSettings({ timer: { ...t, ...patch } });
  const bg = t.bg ?? DEFAULT_TIMER_BG;
  const setBg = (patch: Partial<NonNullable<ServiceTimer["bg"]>>) => set({ bg: { ...bg, ...patch } });
  const centred = t.position === "center";

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--v-text-dim)]">
        Start, pause and reset the timer, set how long it runs and choose its position from the{" "}
        <b>Timer</b> panel on the main screen. Everything else is here.
      </p>

      <section className={card}>
        <span className={label}>Show it on</span>
        <div className="flex gap-2">
          {([
            { k: "live" as const, l: "Main screen", hint: "The projector and any extra screens - what the congregation sees" },
            { k: "stage" as const, l: "Stage display", hint: "The stage display at /#/stage - the platform's own monitor" },
            { k: "stream" as const, l: "Stream", hint: "The OBS / vMix browser source at /#/stream" },
          ]).map((o) => (
            <button
              key={o.k}
              type="button"
              title={o.hint}
              aria-pressed={t.screens[o.k]}
              onClick={() => set({ screens: { ...t.screens, [o.k]: !t.screens[o.k] } })}
              className={`flex-1 rounded-md border px-2 py-2 text-[13px] leading-tight transition-colors ${
                t.screens[o.k]
                  ? "border-[var(--v-accent)] bg-[var(--v-accent-soft)] text-[var(--v-accent)]"
                  : "border-[var(--v-border)] bg-[var(--v-surface-3)] text-[var(--v-text-dim)] hover:text-[var(--v-text)]"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
        {!t.screens.live && !t.screens.stage && !t.screens.stream && (
          <p className="mt-2 text-[12px] text-amber-500">Not showing anywhere - pick a screen above.</p>
        )}
      </section>

      <section className={card}>
        <span className={label}>Counting</span>
        <div className="flex gap-2">
          {(["countdown", "countup"] as const).map((m) => (
            <Choice key={m} on={t.mode === m} onClick={() => set({ mode: m, running: false, frozenMs: null, anchor: null })}>
              {m === "countdown" ? "Count down" : "Count up"}
            </Choice>
          ))}
        </div>
        {t.mode === "countdown" && (
          <label className="mt-3 flex items-center justify-between text-sm text-[var(--v-text-dim)]">
            Keep counting past zero
            <input type="checkbox" checked={t.overrun} onChange={(e) => set({ overrun: e.target.checked })} className="accent-[var(--v-accent)]" />
          </label>
        )}
        <label className="mt-3 block">
          <span className={label}>Label above the digits (optional)</span>
          <input
            placeholder="e.g. Service starts in"
            value={t.label}
            onChange={(e) => set({ label: e.target.value })}
            className={field}
          />
        </label>
      </section>

      <section className={card}>
        <span className={label}>Size</span>
        {centred ? (
          <label className="block text-sm text-[var(--v-text-dim)]">
            {t.fillPct ?? 90}% of the screen width
            <input
              type="range" min={20} max={100} step={5}
              aria-label="Timer size"
              value={t.fillPct ?? 90}
              onChange={(e) => set({ fillPct: Number(e.target.value) })}
              className="w-full accent-[var(--v-accent)]"
            />
          </label>
        ) : (
          <div className="flex gap-2">
            {(["small", "medium", "large"] as const).map((z) => (
              <Choice key={z} on={t.size === z} onClick={() => set({ size: z })}>
                {z[0].toUpperCase() + z.slice(1)}
              </Choice>
            ))}
          </div>
        )}
        <p className="mt-2 text-[12px] text-[var(--v-text-faint)]">
          {centred
            ? "In the centre the timer fills the screen. Make the digits bigger or smaller here."
            : "Small, medium and large apply in a corner. Choose Centre in the Timer panel to fill the screen."}
        </p>
      </section>

      <section className={card}>
        <span className={label}>Digit colour</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Timer digit colour"
            value={/^#[0-9a-f]{6}$/i.test(t.color) ? t.color : "#ffffff"}
            onChange={(e) => set({ color: e.target.value })}
            className="h-10 w-16 shrink-0 cursor-pointer rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)]"
          />
          {/* Quick picks for the usual pairings with a dark, light or coloured backdrop. */}
          {["#FFFFFF", "#000000", "#FFD54A", "#7DD3FC", "#86EFAC", "#FCA5A5"].map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Digit colour ${c}`}
              onClick={() => set({ color: c })}
              style={{ background: c }}
              className={`h-8 w-8 shrink-0 rounded-full border-2 ${t.color.toLowerCase() === c.toLowerCase() ? "border-[var(--v-accent)]" : "border-[var(--v-border)]"}`}
            />
          ))}
        </div>
        <p className="mt-2 text-[12px] text-[var(--v-text-faint)]">
          Pick whatever suits the background. The digits still turn amber for the last seconds of a
          countdown and red once it runs over, so that warning is not lost.
        </p>
      </section>

      <section className={card}>
        <span className={label}>Background</span>
        <div className="flex gap-2">
          {([
            { k: "none" as const, l: "None" },
            { k: "color" as const, l: "Colour" },
            { k: "media" as const, l: "Picture / video" },
          ]).map((o) => (
            <Choice key={o.k} on={bg.kind === o.k} onClick={() => setBg({ kind: o.k })}>
              {o.l}
            </Choice>
          ))}
        </div>
        {bg.kind === "color" && (
          <input
            type="color"
            aria-label="Timer background colour"
            value={bg.color}
            onChange={(e) => setBg({ color: e.target.value })}
            className="mt-3 h-10 w-full cursor-pointer rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)]"
          />
        )}
        {bg.kind === "media" && (
          <div className="mt-3">
            <MediaPicker activeId={bg.mediaId} onSelect={(id) => setBg({ mediaId: id })} defaultMuted />
          </div>
        )}
        <p className="mt-2 text-[12px] text-[var(--v-text-faint)]">
          {centred
            ? "In the centre the background fills the whole screen."
            : "In a corner the background is a small panel behind the digits."}
        </p>
      </section>
    </div>
  );
}
