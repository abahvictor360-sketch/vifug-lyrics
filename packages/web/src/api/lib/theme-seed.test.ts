import { describe, expect, it } from "bun:test";
import { findRedundantThemes } from "./theme-seed";

const base = { fontWeight: 600, bgColor: "#240d39", overlayScrim: 15, safeMargin: 8 };
const media = new Map([["m1", "/backgrounds/rose-nebula.jpg"], ["m2", "/backgrounds/rose-nebula.jpg"], ["m3", "/backgrounds/other.jpg"]]);
const names = ["Rose Nebula", "Plum Studio"];

describe("findRedundantThemes", () => {
  it("removes an identical unused copy, comparing pictures by file", () => {
    const rows = [
      { id: "a", name: "Rose Nebula", backgroundId: "m1", ...base },
      { id: "b", name: "Rose Nebula", backgroundId: "m2", ...base },
      { id: "c", name: "My own theme", backgroundId: null, ...base },
    ];
    expect(findRedundantThemes(rows, names, media, new Set())).toEqual(["b"]);
  });

  it("keeps the copy that is in use and never removes a referenced one", () => {
    const rows = [
      { id: "a", name: "Rose Nebula", backgroundId: "m1", ...base },
      { id: "b", name: "Rose Nebula", backgroundId: "m2", ...base },
    ];
    expect(findRedundantThemes(rows, names, media, new Set(["b"]))).toEqual(["a"]);
    expect(findRedundantThemes(rows, names, media, new Set(["a", "b"]))).toEqual([]);
  });

  it("leaves an edited copy and non-built-in duplicates alone", () => {
    const rows = [
      { id: "a", name: "Rose Nebula", backgroundId: "m1", ...base },
      { id: "b", name: "Rose Nebula", backgroundId: "m3", ...base },
      { id: "c", name: "Rose Nebula", backgroundId: "m1", ...base, overlayScrim: 40 },
      { id: "d", name: "New theme", backgroundId: null, ...base },
      { id: "e", name: "New theme", backgroundId: null, ...base },
    ];
    expect(findRedundantThemes(rows, names, media, new Set())).toEqual([]);
  });
});
