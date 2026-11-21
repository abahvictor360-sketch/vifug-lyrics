import { describe, expect, it } from "bun:test";
import { clampPane, MIN_CENTER_WIDTH, PANE_LIMITS } from "./pane-sizes";

describe("clampPane", () => {
  it("keeps a size inside the pane's limits", () => {
    expect(clampPane("broadcastLibrary", 10)).toBe(PANE_LIMITS.broadcastLibrary.min);
    expect(clampPane("broadcastLibrary", 5000)).toBe(PANE_LIMITS.broadcastLibrary.max);
    expect(clampPane("broadcastLibrary", 300)).toBe(300);
  });

  it("never exceeds the room there is, but never drops below the minimum either", () => {
    expect(clampPane("broadcastControls", 700, 400)).toBe(400);
    // A window too small for even the minimum still gets the minimum, not a collapsed pane.
    expect(clampPane("broadcastControls", 700, 100)).toBe(PANE_LIMITS.broadcastControls.min);
  });

  it("rounds to whole pixels and survives garbage", () => {
    expect(clampPane("vifugRail", 512.6)).toBe(513);
    expect(clampPane("vifugRail", Number.NaN)).toBe(PANE_LIMITS.vifugRail.min);
    expect(clampPane("vifugRail", 500, Number.NaN)).toBe(500);
  });

  it("leaves the slides pane a usable width on the smallest supported desktop window", () => {
    // 1024px window: library and controls at their minimums still leave room for the slides.
    const left = PANE_LIMITS.broadcastLibrary.min + PANE_LIMITS.broadcastControls.min;
    expect(1024 - left).toBeGreaterThanOrEqual(MIN_CENTER_WIDTH);
  });
});
