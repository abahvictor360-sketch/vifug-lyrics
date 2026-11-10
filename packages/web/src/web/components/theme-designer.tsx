import { useCallback, useEffect, useRef, useState } from "react";
import { X, RotateCcw } from "lucide-react";
import { SlideRender } from "./slide-render";
import { FontPicker } from "./font-picker";
import { MediaPicker } from "./media-picker";
import { useDialog } from "../hooks/use-dialog";
import type { Theme as ThemeRow, ThemeDraft } from "../hooks/use-songs";
import { themeToLive, parseTextFrame, type LiveState, type LiveTheme, type TextFrame } from "../lib/live-bus";

/**
 * A visual theme designer: the slide, big, with the box the words sit in drawn
 * on top of it. Drag the box to move it, drag its edges and corners to resize
 * it, and everything else - font, colour, outline, shadow, alignment, the
 * background colour and dimming - sits beside it with the slide updating as
 * you go. The box is stored on the theme, so a lower-third look, a left-hand
 * column or a centred card is one theme like any other.
 */

const PRESETS: { label: string; frame: TextFrame | null }[] = [
  { label: "Full screen", frame: null },
  { label: "Lower third", frame: { x: 6, y: 64, w: 88, h: 30 } },
  { label: "Top band", frame: { x: 6, y: 6, w: 88, h: 26 } },
  { label: "Left half", frame: { x: 4, y: 8, w: 46, h: 84 } },
  { label: "Right half", frame: { x: 50, y: 8, w: 46, h: 84 } },
  { label: "Centre card", frame: { x: 18, y: 24, w: 64, h: 52 } },
];

const SAMPLES: { label: string; lines: string[]; caption: string }[] = [
  { label: "2 lines", lines: ["Amazing grace, how sweet the sound", "That saved a wretch like me"], caption: "Verse 1" },
  { label: "4 lines", lines: ["Amazing grace, how sweet the sound", "That saved a wretch like me", "I once was lost, but now am found", "Was blind, but now I see"], caption: "Verse 1" },
  { label: "Scripture", lines: ["For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."], caption: "John 3:16 · KJV" },
];

type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const HANDLES: { id: Exclude<Handle, "move">; style: React.CSSProperties; cursor: string }[] = [
  { id: "nw", style: { left: 0, top: 0 }, cursor: "nwse-resize" },
  { id: "n", style: { left: "50%", top: 0 }, cursor: "ns-resize" },
  { id: "ne", style: { left: "100%", top: 0 }, cursor: "nesw-resize" },
  { id: "e", style: { left: "100%", top: "50%" }, cursor: "ew-resize" },
  { id: "se", style: { left: "100%", top: "100%" }, cursor: "nwse-resize" },
  { id: "s", style: { left: "50%", top: "100%" }, cursor: "ns-resize" },
  { id: "sw", style: { left: 0, top: "100%" }, cursor: "nesw-resize" },
  { id: "w", style: { left: 0, top: "50%" }, cursor: "ew-resize" },
];

const MIN_W = 10;
const MIN_H = 8;
const round = (n: number) => Math.round(n * 2) / 2;

/** Pull a value to a guide (edge, centre) when it is within a hair of it. */
function snap(v: number, guides: number[], reach = 1.2): { v: number; hit: number | null } {
  for (const g of guides) if (Math.abs(v - g) <= reach) return { v: g, hit: g };
  return { v, hit: null };
}

function parseShadow(raw: string | null | undefined): { color: string; blur: number; x: number; y: number } | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseOutline(raw: string | null | undefined): { color: string; width: number } {
  if (!raw) return { color: "#000000", width: 0 };
  try {
    const o = JSON.parse(raw) as { color?: string; width?: number };
    return { color: o.color ?? "#000000", width: Number(o.width) || 0 };
  } catch {
    return { color: "#000000", width: 0 };
  }
}

const label = "mb-1 block text-[11px] uppercase tracking-wide text-[var(--v-text-faint)]";
const field = "w-full rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--v-accent)]";

export function ThemeDesigner({
  theme,
  patch,
  previewBackground,
  activeBackgroundId,
  onPickBackground,
  mediaDefaults,
  onClose,
}: {
  theme: ThemeRow;
  patch: (p: ThemeDraft) => void;
  /** The picture on the live screen right now (null = none). */
  activeBackgroundId?: string | null;
  /** Put a picture behind the words on the screen; the theme remembers it too. */
  onPickBackground?: (id: string | null) => void;
  mediaDefaults?: { fit?: "cover" | "contain" | "fill"; muted?: boolean };
  /** The picture behind the words on the live screen, so the canvas matches it. */
  previewBackground?: LiveTheme["background"];
  onClose: () => void;
}) {
  const dialog = useDialog();
  // Edits show at once and are saved as they are made; the row catches up a
  // moment later, so what is drawn is never waiting on the network.
  const [draft, setDraft] = useState<ThemeDraft>({});
  const row = { ...theme, ...draft } as ThemeRow;
  const change = useCallback(
    (p: ThemeDraft) => {
      setDraft((d) => ({ ...d, ...p }));
      patch(p);
    },
    [patch],
  );
  useEffect(() => setDraft({}), [theme.id]);

  const [sample, setSample] = useState(0);
  const frame = parseTextFrame(row.textFrame);
  const shown: TextFrame = frame ?? { x: 8, y: 8, w: 84, h: 84 };
  // While dragging, the box follows the pointer without saving every pixel.
  const [live, setLive] = useState<TextFrame | null>(null);
  const box = live ?? shown;
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ h: Handle; sx: number; sy: number; start: TextFrame } | null>(null);

  function begin(e: React.PointerEvent, h: Handle) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { h, sx: e.clientX, sy: e.clientY, start: { ...box } };
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    const el = canvasRef.current;
    if (!d || !el) return;
    const r = el.getBoundingClientRect();
    const dx = ((e.clientX - d.sx) / r.width) * 100;
    const dy = ((e.clientY - d.sy) / r.height) * 100;
    let { x, y, w, h } = d.start;
    const hitX: (number | null)[] = [];
    const hitY: (number | null)[] = [];
    const gx = [0, 50, 100];
    const gy = [0, 50, 100];

    if (d.h === "move") {
      let nx = d.start.x + dx;
      let ny = d.start.y + dy;
      // The box's left, centre and right edges snap to the slide's guides.
      for (const off of [0, w / 2, w]) {
        const s = snap(nx + off, gx);
        if (s.hit !== null) {
          nx = s.v - off;
          hitX.push(s.hit);
          break;
        }
      }
      for (const off of [0, h / 2, h]) {
        const s = snap(ny + off, gy);
        if (s.hit !== null) {
          ny = s.v - off;
          hitY.push(s.hit);
          break;
        }
      }
      x = Math.min(100 - w, Math.max(0, nx));
      y = Math.min(100 - h, Math.max(0, ny));
    } else {
      const right = d.start.x + d.start.w;
      const bottom = d.start.y + d.start.h;
      if (d.h.includes("w")) {
        const s = snap(Math.min(right - MIN_W, Math.max(0, d.start.x + dx)), gx);
        x = s.v;
        w = right - x;
        if (s.hit !== null) hitX.push(s.hit);
      }
      if (d.h.includes("e")) {
        const s = snap(Math.max(x + MIN_W, Math.min(100, right + dx)), gx);
        w = s.v - x;
        if (s.hit !== null) hitX.push(s.hit);
      }
      if (d.h.includes("n")) {
        const s = snap(Math.min(bottom - MIN_H, Math.max(0, d.start.y + dy)), gy);
        y = s.v;
        h = bottom - y;
        if (s.hit !== null) hitY.push(s.hit);
      }
      if (d.h.includes("s")) {
        const s = snap(Math.max(y + MIN_H, Math.min(100, bottom + dy)), gy);
        h = s.v - y;
        if (s.hit !== null) hitY.push(s.hit);
      }
    }
    setLive({ x: round(x), y: round(y), w: round(w), h: round(h) });
    setGuides({ x: hitX[0] ?? null, y: hitY[0] ?? null });
  }

  function end() {
    if (drag.current && live) change({ textFrame: JSON.stringify(live) });
    drag.current = null;
    setLive(null);
    setGuides({ x: null, y: null });
  }

  const setNum = (k: keyof TextFrame, v: number) => {
    if (!Number.isFinite(v)) return;
    const f = { ...shown, [k]: v };
    f.w = Math.min(100, Math.max(MIN_W, f.w));
    f.h = Math.min(100, Math.max(MIN_H, f.h));
    f.x = Math.min(100 - f.w, Math.max(0, f.x));
    f.y = Math.min(100 - f.h, Math.max(0, f.y));
    change({ textFrame: JSON.stringify(f) });
  };

  const outline = parseOutline(row.textOutline);
  const shadow = parseShadow(row.textShadow);
  const liveTheme: LiveTheme = {
    ...themeToLive(row as unknown as Record<string, unknown>),
    background: previewBackground ?? null,
    textFrame: live ? live : frame,
  };
  const s = SAMPLES[sample]!;
  const state: LiveState = {
    status: "live",
    sourceLines: s.lines,
    translationLines: [],
    sectionLabel: s.caption,
    songTitle: "",
    slideId: null,
    slideIndex: 0,
    slideCount: 1,
    theme: { ...liveTheme, showCaption: true },
    rev: 0,
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-3 sm:p-6" onClick={onClose}>
      <div
        ref={dialog.ref}
        {...dialog.dialogProps}
        aria-labelledby="designer-title"
        onClick={(e) => e.stopPropagation()}
        className="focus:outline-none flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[var(--v-border)] bg-[var(--v-surface-2)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--v-border)] px-4 py-3">
          <h2 id="designer-title" className="text-sm font-semibold">
            Design theme: <span className="text-[var(--v-accent)]">{theme.name}</span>
          </h2>
          <button onClick={onClose} aria-label="Close the designer" className="rounded p-1 text-[var(--v-text-faint)] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* The slide, with the text box on top of it. */}
          <div className="min-w-0">
            <div
              ref={canvasRef}
              className="relative aspect-video w-full select-none overflow-hidden rounded-lg border border-[var(--v-border)] bg-black"
              style={{ containerType: "size", touchAction: "none" }}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            >
              <SlideRender state={state} scale />
              {/* Guides appear while a box edge is on the middle or an edge. */}
              {guides.x !== null && <span className="pointer-events-none absolute inset-y-0 w-px bg-[var(--v-accent)]" style={{ left: `${guides.x}%` }} />}
              {guides.y !== null && <span className="pointer-events-none absolute inset-x-0 h-px bg-[var(--v-accent)]" style={{ top: `${guides.y}%` }} />}
              <div
                role="group"
                aria-label="Text box"
                onPointerDown={(e) => begin(e, "move")}
                className="absolute cursor-move border-2 border-dashed border-[var(--v-accent)]"
                style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`, background: "rgba(163,230,53,0.06)" }}
              >
                {HANDLES.map((h) => (
                  <span
                    key={h.id}
                    onPointerDown={(e) => begin(e, h.id)}
                    data-handle={h.id}
                    className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-black bg-[var(--v-accent)]"
                    style={{ ...h.style, cursor: h.cursor }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-[var(--v-text-faint)]">Sample</span>
              {SAMPLES.map((x, i) => (
                <button
                  key={x.label}
                  onClick={() => setSample(i)}
                  className={`rounded-md border px-2.5 py-1 text-xs ${sample === i ? "border-[var(--v-accent)] bg-[var(--v-accent-soft)] text-[var(--v-accent)]" : "border-[var(--v-border)]"}`}
                >
                  {x.label}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-[var(--v-text-faint)]">Drag the box to move it, its edges to resize. Saved as you go.</span>
            </div>
          </div>

          {/* Everything else about the look. */}
          <div className="space-y-4">
            <section>
              <p className={label}>Text box</p>
              <div className="mb-2 grid grid-cols-3 gap-1">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => change({ textFrame: p.frame ? JSON.stringify(p.frame) : null })}
                    className="rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)] px-1 py-1.5 text-[11px] hover:border-[var(--v-accent)]"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(["x", "y", "w", "h"] as const).map((k) => (
                  <label key={k} className="text-[11px] text-[var(--v-text-faint)]">
                    {k === "x" ? "Left" : k === "y" ? "Top" : k === "w" ? "Width" : "Height"}
                    <input type="number" min={0} max={100} step={0.5} value={Math.round(box[k] * 2) / 2} onChange={(e) => setNum(k, Number(e.target.value))} className={field} />
                  </label>
                ))}
              </div>
              <div className="mt-2 flex gap-1.5">
                {(["top", "center", "bottom"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => change({ verticalPos: v })}
                    className={`flex-1 rounded-md border px-2 py-1 text-xs capitalize ${(row.verticalPos ?? "center") === v ? "border-[var(--v-accent)] bg-[var(--v-accent-soft)] text-[var(--v-accent)]" : "border-[var(--v-border)]"}`}
                  >
                    {v === "center" ? "Middle" : v}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-[var(--v-text-faint)]">Where the words sit inside the box.</p>
            </section>

            <section>
              <p className={label}>Font</p>
              <FontPicker value={row.fontFamily ?? null} onChange={(v) => change({ fontFamily: v })} />
              <div className="mt-2">
                <div className="flex items-center justify-between text-[11px] text-[var(--v-text-faint)]">
                  <span>Font size {row.fontSize ? `${row.fontSize}px` : "(auto-fit)"}</span>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!row.fontSize}
                      onChange={(e) => change({ fontSize: e.target.checked ? null : 64 })}
                    />
                    Auto-fit
                  </label>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="range"
                    min={24}
                    max={240}
                    step={2}
                    value={row.fontSize ?? 64}
                    onChange={(e) => change({ fontSize: Number(e.target.value) })}
                    className="min-w-0 flex-1"
                    aria-label="Font size"
                  />
                  <input
                    type="number"
                    min={12}
                    max={240}
                    placeholder="auto"
                    value={row.fontSize ?? ""}
                    onChange={(e) => change({ fontSize: e.target.value === "" ? null : Number(e.target.value) })}
                    className={`${field} w-16`}
                  />
                </div>
                <p className="mt-1 text-[11px] text-[var(--v-text-faint)]">
                  Auto-fit sizes the words to fill the box. A fixed size stays put and shows on the canvas straight away.
                </p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-[11px] text-[var(--v-text-faint)]">
                  Weight
                  <select value={row.fontWeight ?? 600} onChange={(e) => change({ fontWeight: Number(e.target.value) })} className={field}>
                    {[300, 400, 500, 600, 700, 800, 900].map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-2 flex gap-1.5">
                {(["left", "center", "right"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => change({ textAlign: a })}
                    className={`flex-1 rounded-md border px-2 py-1 text-xs capitalize ${(row.textAlign ?? "center") === a ? "border-[var(--v-accent)] bg-[var(--v-accent-soft)] text-[var(--v-accent)]" : "border-[var(--v-border)]"}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <p className={label}>Colours</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-[var(--v-text-faint)]">
                  Text
                  <input type="color" value={row.textColor ?? "#FFFFFF"} onChange={(e) => change({ textColor: e.target.value })} className="h-8 w-full cursor-pointer rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)]" />
                </label>
                <label className="text-[11px] text-[var(--v-text-faint)]">
                  Background
                  <input type="color" value={row.bgColor ?? "#000000"} onChange={(e) => change({ bgColor: e.target.value })} className="h-8 w-full cursor-pointer rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)]" />
                </label>
              </div>
              <label className="mt-2 block text-[11px] text-[var(--v-text-faint)]">
                Dim the background picture {row.overlayScrim ?? 0}%
                <input type="range" min={0} max={90} value={row.overlayScrim ?? 0} onChange={(e) => change({ overlayScrim: Number(e.target.value) })} className="w-full" />
              </label>
            </section>

            <section>
              <p className={label}>Background picture or video</p>
              <MediaPicker
                activeId={draft.backgroundId !== undefined ? draft.backgroundId : (activeBackgroundId ?? theme.backgroundId ?? null)}
                onSelect={(id) => {
                  change({ backgroundId: id });
                  onPickBackground?.(id);
                }}
                defaultFit={mediaDefaults?.fit ?? "cover"}
                defaultMuted={mediaDefaults?.muted ?? false}
              />
              <p className="mt-1 text-[11px] text-[var(--v-text-faint)]">
                Upload an image or video, paste a link, or pick a colour. It is saved with this theme and shows on the canvas straight away.
              </p>
            </section>

            <section>
              <p className={label}>Outline &amp; shadow</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-[var(--v-text-faint)]">
                  Outline {outline.width}px
                  <input type="range" min={0} max={8} value={outline.width} onChange={(e) => change({ textOutline: JSON.stringify({ color: outline.color, width: Number(e.target.value) }) })} className="w-full" />
                </label>
                <label className="text-[11px] text-[var(--v-text-faint)]">
                  Outline colour
                  <input type="color" value={outline.color.startsWith("#") ? outline.color : "#000000"} onChange={(e) => change({ textOutline: JSON.stringify({ color: e.target.value, width: outline.width }) })} className="h-8 w-full cursor-pointer rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)]" />
                </label>
              </div>
              <label className="mt-2 block text-[11px] text-[var(--v-text-faint)]">
                Shadow {shadow ? `${shadow.blur}px blur` : "off"}
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={shadow?.blur ?? 0}
                  onChange={(e) => {
                    const blur = Number(e.target.value);
                    change({ textShadow: blur === 0 ? null : JSON.stringify({ color: shadow?.color ?? "rgba(0,0,0,0.85)", blur, x: 0, y: Math.max(2, Math.round(blur / 4)) }) });
                  }}
                  className="w-full"
                />
              </label>
            </section>

            <button
              onClick={() => change({ textFrame: null, fontFamily: null, textShadow: null, fontSize: null, verticalPos: "center", textAlign: "center" })}
              className="inline-flex items-center gap-1.5 text-[11px] text-[var(--v-text-faint)] underline"
            >
              <RotateCcw className="h-3 w-3" /> Reset box, font and shadow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
