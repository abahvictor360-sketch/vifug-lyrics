import { describe, expect, it } from "vitest";
import { TEXT_MOTIONS, textMotionKeyframes } from "./live-bus";

describe("text motions", () => {
  it("every choice the menus offer animates, except an explicit cut", () => {
    for (const m of TEXT_MOTIONS) {
      if (m.id === "none") expect(textMotionKeyframes(m.id)).toBeNull();
      else expect(textMotionKeyframes(m.id)?.length, m.id).toBeGreaterThanOrEqual(2);
    }
  });
  it("the stored default, and the old plain 'slide', are visible transitions", () => {
    expect(textMotionKeyframes("fade")).not.toBeNull();
    expect(textMotionKeyframes("slide")).not.toBeNull();
  });
});
