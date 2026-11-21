import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/**
 * The divider between two panes. Drag it, or focus it and use the arrow keys.
 * Double-click puts the pane back to its built-in size.
 *
 * `vertical` is a divider that stands upright between two columns and changes
 * a WIDTH; `horizontal` lies flat between two rows and changes a HEIGHT.
 * `direction` is +1 when the pane being resized is before the divider (to its
 * left or above it) and -1 when it is after, so dragging toward a pane always
 * makes that pane smaller.
 */
export function ResizeHandle({
  orientation,
  value,
  min,
  max,
  direction,
  label,
  onChange,
  onReset,
  className = "",
}: {
  orientation: "vertical" | "horizontal";
  value: number;
  min: number;
  max: number;
  direction: 1 | -1;
  label: string;
  onChange: (px: number) => void;
  onReset: () => void;
  className?: string;
}) {
  const start = useRef<{ at: number; size: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const vertical = orientation === "vertical";

  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { at: vertical ? e.clientX : e.clientY, size: value };
    setDragging(true);
    // While dragging, the cursor and text selection belong to the divider,
    // wherever the pointer wanders - including over an embedded preview.
    document.body.style.cursor = vertical ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s) return;
    const delta = ((vertical ? e.clientX : e.clientY) - s.at) * direction;
    onChange(clamp(s.size + delta));
  };
  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    start.current = null;
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 64 : 16;
    const grow = vertical ? "ArrowRight" : "ArrowDown";
    const shrink = vertical ? "ArrowLeft" : "ArrowUp";
    if (e.key === grow) onChange(clamp(value + step * direction));
    else if (e.key === shrink) onChange(clamp(value - step * direction));
    else if (e.key === "Home") onChange(min);
    else if (e.key === "End") onChange(max);
    else if (e.key === "Enter" || e.key === " ") onReset();
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      tabIndex={0}
      title={`${label}. Drag to resize, double-click to reset.`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={onReset}
      onKeyDown={key}
      className={`group relative z-10 shrink-0 touch-none outline-none ${
        vertical ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize"
      } ${className}`}
    >
      {/* The visible line is thin; the hit area around it is not. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute transition-colors ${
          vertical ? "inset-y-0 left-1/2 w-px -translate-x-1/2" : "inset-x-0 top-1/2 h-px -translate-y-1/2"
        } ${
          dragging
            ? "bg-[var(--v-accent)]"
            : "bg-[var(--v-border)] group-hover:bg-[var(--v-accent)] group-focus-visible:bg-[var(--v-accent)]"
        }`}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute rounded-full bg-[var(--v-accent)] opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70 ${
          dragging ? "opacity-90" : ""
        } ${vertical ? "left-1/2 top-1/2 h-8 w-[3px] -translate-x-1/2 -translate-y-1/2" : "left-1/2 top-1/2 h-[3px] w-8 -translate-x-1/2 -translate-y-1/2"}`}
      />
    </div>
  );
}
