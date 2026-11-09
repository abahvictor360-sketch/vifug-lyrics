import { expect, it } from "bun:test";
import { shapeRatio } from "./capture-shape";

it("turns a shape into a width/height ratio", () => {
  expect(shapeRatio(undefined)).toBeNull();
  expect(shapeRatio({ aspect: "source" })).toBeNull();
  expect(shapeRatio({ aspect: "1:1" })).toBe(1);
  expect(shapeRatio({ aspect: "9:16" })).toBeCloseTo(0.5625);
  expect(shapeRatio({ aspect: "custom", ratio: 2 })).toBe(2);
  expect(shapeRatio({ aspect: "custom", ratio: 99 })).toBeNull();
});
