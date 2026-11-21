import { useLayoutEffect, useState, type RefObject } from "react";

/** The nearest ancestor that clips its contents, or the window if nothing does. */
function clipRect(el: HTMLElement): { left: number; right: number } {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.overflowX !== "visible") {
      const r = n.getBoundingClientRect();
      return { left: r.left, right: r.right };
    }
  }
  return { left: 0, right: window.innerWidth };
}

/**
 * How far to move a floating toolbar sideways so it stays fully visible.
 *
 * The text toolbars are centred over the selected words, which is right in the
 * middle of a box and wrong at its edge: select the first word of a slide and
 * half the toolbar sat outside the scrolling panel, clipped, with Bold and
 * Italic out of reach. This measures the toolbar against whatever clips it and
 * returns the nudge (in pixels, apply it as margin-left) that brings it back.
 */
export function useToolbarFit(
  toolbarRef: RefObject<HTMLElement | null>,
  visible: boolean,
  anchor: unknown,
): number {
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    const el = toolbarRef.current;
    if (!el || !visible) {
      setShift(0);
      return;
    }
    const r = el.getBoundingClientRect();
    // r already includes the shift applied last time; take it back out.
    const left = r.left - shift;
    const right = r.right - shift;
    const bounds = clipRect(el);
    const pad = 6;
    let need = 0;
    if (right > bounds.right - pad) need = bounds.right - pad - right;
    if (left + need < bounds.left + pad) need = bounds.left + pad - left;
    if (Math.abs(need - shift) > 0.5) setShift(Math.round(need));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolbarRef, visible, anchor]);
  return shift;
}
