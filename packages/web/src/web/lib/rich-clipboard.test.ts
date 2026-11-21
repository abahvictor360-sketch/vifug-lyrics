import { describe, expect, it } from "bun:test";
import { applyMarks, marksInRange, normalize, readableOn, runStyle, toRunLines } from "./rich-text";
import {
  copyRich, insertRich, readRich, richPayload, richToHtml, sliceFormats, splitRichParagraphs, RICH_MIME,
} from "./rich-clipboard";

/** A DataTransfer stand-in: enough of the interface for copy and paste. */
function clip() {
  const store = new Map<string, string>();
  const dt = {
    setData: (t: string, v: string) => void store.set(t, v),
    getData: (t: string) => store.get(t) ?? "",
  } as unknown as DataTransfer;
  let prevented = false;
  return { dt, event: { clipboardData: dt, preventDefault: () => { prevented = true; } }, get prevented() { return prevented; }, store };
}

describe("highlight mark", () => {
  it("applies, reads back and clears like the other marks", () => {
    let f = applyMarks([], 2, 6, { highlight: "#facc15" });
    expect(f).toEqual([{ start: 2, end: 6, highlight: "#facc15" }]);
    expect(marksInRange(f, 2, 6).highlight).toBe("#facc15");
    expect(marksInRange(f, 0, 6).highlight).toBeUndefined(); // only part of the range
    f = applyMarks(f, 3, 5, { highlight: null });
    expect(f).toEqual([{ start: 2, end: 3, highlight: "#facc15" }, { start: 5, end: 6, highlight: "#facc15" }]);
  });

  it("keeps underline and highlight together, and survives toRunLines", () => {
    const f = applyMarks(applyMarks([], 0, 5, { underline: true }), 0, 5, { highlight: "#a3e635" });
    expect(f).toEqual([{ start: 0, end: 5, underline: true, highlight: "#a3e635" }]);
    const runs = toRunLines("Hello world", f)[0]!;
    expect(runs[0]).toMatchObject({ text: "Hello", underline: true, highlight: "#a3e635" });
  });

  it("paints a background without adding any padding, and keeps the words readable on it", () => {
    const s = runStyle({ highlight: "#facc15" });
    expect(s.backgroundColor).toBe("#facc15");
    expect(s.padding).toBeUndefined();
    expect(s.color).toBe("#0b0e14"); // dark text on a light highlight
    expect(runStyle({ highlight: "#facc15", color: "#ffffff" }).color).toBe("#ffffff"); // an explicit colour wins
    expect(readableOn("#1d4ed8")).toBe("#ffffff");
  });

  it("two adjacent ranges with the same highlight merge", () => {
    expect(normalize([{ start: 0, end: 2, highlight: "#fff000" }, { start: 2, end: 4, highlight: "#fff000" }])).toHaveLength(1);
  });
});

describe("styled copy and paste", () => {
  const text = "For God so loved the world";
  const formats = [
    { start: 4, end: 7, bold: true },
    { start: 8, end: 14, underline: true, highlight: "#facc15" },
  ];

  it("copies only the styled span that was selected, rebased to zero", () => {
    expect(sliceFormats(formats, 4, 14)).toEqual([
      { start: 0, end: 3, bold: true },
      { start: 4, end: 10, underline: true, highlight: "#facc15" },
    ]);
    expect(richPayload(text, formats, 8, 14)).toEqual({ text: "so lov", formats: [{ start: 0, end: 6, underline: true, highlight: "#facc15" }] });
  });

  it("puts plain text, HTML and Vifug's own type on the clipboard, and reads it back", () => {
    const c = clip();
    expect(copyRich(c.event, richPayload(text, formats, 4, 14))).toBe(true);
    expect(c.prevented).toBe(true);
    expect(c.store.get("text/plain")).toBe("God so lov");
    expect(c.store.get("text/html")).toContain("font-weight:bold");
    expect(c.store.get("text/html")).toContain("background-color:#facc15");
    expect(c.store.has(RICH_MIME)).toBe(true);
    expect(readRich({ clipboardData: c.dt })?.formats).toHaveLength(2);
  });

  it("does nothing for unstyled text, so the browser's own copy runs", () => {
    const c = clip();
    expect(copyRich(c.event, richPayload(text, [], 0, 7))).toBe(false);
    expect(c.prevented).toBe(false);
  });

  it("ignores the saved style when the clipboard now holds something else", () => {
    const c = clip();
    copyRich(c.event, richPayload(text, formats, 4, 14));
    const other = clip();
    other.dt.setData("text/plain", "something copied elsewhere");
    expect(readRich({ clipboardData: other.dt })).toBeNull();
  });

  it("falls back to the in-memory copy when the browser drops custom clipboard types", () => {
    const c = clip();
    copyRich(c.event, richPayload(text, formats, 4, 14));
    const stripped = clip();
    stripped.dt.setData("text/plain", "God so lov");
    expect(readRich({ clipboardData: stripped.dt })?.formats).toHaveLength(2);
  });

  it("pastes with its own style and none from the words around it", () => {
    const payload = { text: "bold", formats: [{ start: 0, end: 4, bold: true }] };
    // Pasting plain-looking words into the middle of an underlined phrase.
    const into = insertRich("abcdefgh", [{ start: 0, end: 8, underline: true }], 3, 3, { text: "XY", formats: [{ start: 0, end: 1, italic: true }] });
    expect(into.value).toBe("abcXYdefgh");
    expect(into.formats).toEqual([
      { start: 0, end: 3, underline: true },
      { start: 3, end: 4, italic: true },
      { start: 5, end: 10, underline: true },
    ]);
    expect(into.caret).toBe(5);
    const replaced = insertRich("one two", [], 4, 7, payload);
    expect(replaced.value).toBe("one bold");
    expect(replaced.formats).toEqual([{ start: 4, end: 8, bold: true }]);
  });

  it("splits a styled multi-paragraph copy into paragraphs, each with its own style", () => {
    const p = { text: "First para\n\nSecond para", formats: [{ start: 0, end: 5, bold: true }, { start: 12, end: 18, underline: true }] };
    const parts = splitRichParagraphs(p);
    expect(parts.map((x) => x.text)).toEqual(["First para", "Second para"]);
    expect(parts[0]!.formats).toEqual([{ start: 0, end: 5, bold: true }]);
    expect(parts[1]!.formats).toEqual([{ start: 0, end: 6, underline: true }]);
  });

  it("HTML escapes the text", () => {
    expect(richToHtml({ text: "<b>&", formats: [{ start: 0, end: 1, bold: true }] })).toContain("&lt;");
  });
});
