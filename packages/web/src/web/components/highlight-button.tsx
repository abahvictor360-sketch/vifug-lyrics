import { useState } from "react";
import { Eraser, Highlighter } from "lucide-react";

/**
 * Highlighter pen for the text toolbars: one button that opens a few
 * marker colours, plus an eraser that takes the highlight off.
 *
 * Shared by the editable text box and the Bible verse toolbar so a colour
 * picked in one is the same colour in the other. The colours are the ones that
 * stay legible behind white or dark text when projected, not a full palette.
 */
export const HIGHLIGHTS = [
  { hex: "#facc15", name: "Yellow" },
  { hex: "#a3e635", name: "Green" },
  { hex: "#fb923c", name: "Orange" },
  { hex: "#f472b6", name: "Pink" },
  { hex: "#38bdf8", name: "Blue" },
  { hex: "#c084fc", name: "Purple" },
];

export function HighlightButton({
  active,
  onPick,
}: {
  /** The highlight every selected character already has, if they all share one. */
  active?: string;
  onPick: (hex: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button
        type="button"
        title="Highlight"
        aria-label="Highlight"
        aria-pressed={!!active}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`grid h-6 w-6 place-items-center rounded transition-colors ${
          active
            ? "bg-[var(--v-accent-soft)] text-[var(--v-accent)]"
            : "text-[var(--v-text-dim)] hover:bg-[var(--v-surface-2)] hover:text-[var(--v-text)]"
        }`}
      >
        <Highlighter className="h-3.5 w-3.5" style={active ? { color: active } : undefined} />
      </button>
      {open && (
        <span className="absolute left-1/2 top-full z-40 mt-1.5 flex -translate-x-1/2 gap-1 rounded-lg border border-[var(--v-border)] bg-[var(--v-surface-3)] p-1.5 shadow-lg">
          {HIGHLIGHTS.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={`${c.name} highlight`}
              aria-label={`${c.name} highlight`}
              onClick={() => {
                onPick(c.hex);
                setOpen(false);
              }}
              style={{ background: c.hex }}
              className={`h-5 w-5 rounded border transition-transform hover:scale-110 ${
                active === c.hex ? "border-white ring-2 ring-white/60" : "border-black/30"
              }`}
            />
          ))}
          <button
            type="button"
            title="No highlight"
            aria-label="No highlight"
            onClick={() => {
              onPick(null);
              setOpen(false);
            }}
            className="grid h-5 w-5 place-items-center rounded border border-[var(--v-border)] bg-[var(--v-surface)] text-[var(--v-text-faint)] hover:text-[var(--v-text)]"
          >
            <Eraser className="h-2.5 w-2.5" />
          </button>
        </span>
      )}
    </span>
  );
}
