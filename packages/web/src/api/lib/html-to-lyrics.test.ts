import { describe, expect, it } from "bun:test";
import { htmlToLyrics } from "./html-to-lyrics";

const LINES = [
  "Holy, holy, holy! Lord God Almighty!",
  "Early in the morning our song shall rise to Thee;",
  "Holy, holy, holy! Merciful and mighty!",
  "God in three Persons, blessed Trinity!",
];

const page = (inner: string) =>
  `<html><head><title>Holy, Holy, Holy - Reginald Heber</title></head>` +
  `<body><main><div class="lyrics">${inner}</div></main></body></html>`;

describe("htmlToLyrics line breaks", () => {
  it("keeps one lyric per line when the song is in <pre>", () => {
    // A hymn archive or chord-chart site lays the song out as preformatted
    // text with no <br> in it. The newlines are the only line breaks there
    // are, so flattening them collapsed the whole song into one line and the
    // import arrived as a run-on paragraph.
    const out = htmlToLyrics(page(`<pre>\n${LINES.join("\n")}\n</pre>`));
    expect(out.split("\n").filter(Boolean)).toEqual(LINES);
  });

  it("keeps stanza breaks from blank lines in <pre>", () => {
    const stanzas = `${LINES.join("\n")}\n\n${LINES.join("\n")}`;
    const out = htmlToLyrics(page(`<pre>\n${stanzas}\n</pre>`));
    expect(out.split(/\n{2,}/).filter((s) => s.trim()).length).toBe(2);
  });

  it("still handles <br> and <p> markup the same way", () => {
    for (const inner of [LINES.join("<br/>"), LINES.map((l) => `<p>${l}</p>`).join("")]) {
      expect(htmlToLyrics(page(inner)).split("\n").filter(Boolean)).toEqual(LINES);
    }
  });

  it("still flattens source newlines outside <pre>", () => {
    // What the flattening is there for: pages write a line as "<br />\n", so
    // turning the tag into a newline without dropping the source one yields a
    // blank line after every line and imports the song as a stack of
    // one-line verses. The <pre> fix must not reach outside <pre>.
    const out = htmlToLyrics(page(LINES.map((l) => `${l}<br />\n`).join("")));
    expect(out.split("\n").filter(Boolean)).toEqual(LINES);
    expect(out).not.toMatch(/\n{2,}/);
  });
});
