import { describe, expect, it } from "bun:test";
import { blocksMultiClickSelect } from "./no-multiclick-select";

/** A stand-in element that is, or sits inside, something matching the selector list. */
const el = (insideEditable: boolean) => ({ closest: () => (insideEditable ? {} : null) });

describe("blocksMultiClickSelect", () => {
  it("never interferes with a single press, so dragging a selection still works", () => {
    expect(blocksMultiClickSelect(el(false), 1)).toBe(false);
    expect(blocksMultiClickSelect(el(false), 0)).toBe(false);
  });
  it("stops the second and third click of a double or triple click on ordinary content", () => {
    expect(blocksMultiClickSelect(el(false), 2)).toBe(true);
    expect(blocksMultiClickSelect(el(false), 3)).toBe(true);
  });
  it("leaves text fields alone, so double-clicking a word while editing still selects it", () => {
    expect(blocksMultiClickSelect(el(true), 2)).toBe(false);
  });
  it("treats a text node as its parent element", () => {
    const textNode = { parentElement: el(false) };
    expect(blocksMultiClickSelect(textNode, 2)).toBe(true);
    expect(blocksMultiClickSelect({ parentElement: el(true) }, 2)).toBe(false);
  });
  it("does nothing for a target that is not an element", () => {
    expect(blocksMultiClickSelect(null, 2)).toBe(false);
    expect(blocksMultiClickSelect({}, 2)).toBe(false);
  });
});
