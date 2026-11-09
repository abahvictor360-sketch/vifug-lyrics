import { expect, it } from "bun:test";
import { parseTextFrame, themeToLive } from "./live-bus";

it("parses and clamps a text frame", () => {
  expect(parseTextFrame(null)).toBeNull();
  expect(parseTextFrame("nope")).toBeNull();
  expect(parseTextFrame('{"x":10,"y":20,"w":50,"h":40}')).toEqual({ x: 10, y: 20, w: 50, h: 40 });
  // A box can't spill off the slide or shrink to nothing.
  expect(parseTextFrame({ x: 90, y: 90, w: 50, h: 50 })).toEqual({ x: 50, y: 50, w: 50, h: 50 });
  expect(parseTextFrame({ x: 0, y: 0, w: 1, h: 1 })).toEqual({ x: 0, y: 0, w: 10, h: 8 });
});

it("carries the frame, font and shadow from a theme row", () => {
  const t = themeToLive({
    textFrame: '{"x":5,"y":60,"w":90,"h":30}',
    fontFamily: "Georgia, serif",
    textShadow: '{"color":"#000","blur":8,"x":0,"y":2}',
  });
  expect(t.textFrame).toEqual({ x: 5, y: 60, w: 90, h: 30 });
  expect(t.fontFamily).toBe("Georgia, serif");
  expect(t.textShadow?.blur).toBe(8);
});
