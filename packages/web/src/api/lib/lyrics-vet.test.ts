import { describe, expect, it } from "bun:test";
import { parseSongSearch, vetLyrics } from "./lyrics-vet";

const song = `Amazing grace how sweet the sound
That saved a wretch like me
I once was lost but now am found
Was blind but now I see

Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed`;

describe("vetLyrics", () => {
  it("leaves a clean song untouched", () => {
    const v = vetLyrics(song, { title: "Amazing Grace" });
    expect(v.text).toBe(song);
    expect(v.verdict).toBe("good");
    expect(v.changes).toEqual([]);
  });

  it("strips chord lines, inline chords, timestamps and the echoed title", () => {
    const messy = `Amazing Grace Lyrics\nG   D   Em   C\n[00:12.30] [G]Amazing grace how sweet the sound\nThat saved a wretch like me\nI once was lost but now am found\nWas blind but now I see\nx2`;
    const v = vetLyrics(messy, { title: "Amazing Grace" });
    expect(v.text.startsWith("Amazing grace how sweet")).toBe(true);
    expect(v.text).not.toContain("G   D");
    expect(v.text).not.toContain("[00");
    expect(v.text).not.toContain("x2");
    expect(v.changes.length).toBeGreaterThanOrEqual(4);
  });

  it("keeps a lyric line that is a single word like 'A' or 'Amen'", () => {
    const v = vetLyrics(`Oh we praise\nYour name forever\nAmen\nA\nHallelujah to the King`);
    expect(v.text).toContain("Amen");
    expect(v.text).toContain("Hallelujah");
  });

  it("collapses a song the page printed twice", () => {
    const v = vetLyrics(`${song}\n\n${song}`);
    expect(v.text).toBe(song);
    expect(v.changes.join(" ")).toContain("twice");
  });

  it("flags prose and snippets", () => {
    const prose = "This is a long paragraph about the history of the hymn and its author who wrote it in the seventeen hundreds while reflecting on his life as a ship captain and slave trader before his conversion. ".repeat(3);
    expect(vetLyrics(prose).verdict).toBe("poor");
    expect(vetLyrics("one line\ntwo lines").verdict).toBe("check");
  });
});

describe("parseSongSearch", () => {
  it("vets, de-duplicates and skips instrumentals and empties", () => {
    const hits = parseSongSearch([
      { id: 1, trackName: "Amazing Grace", artistName: "John Newton", plainLyrics: song },
      { id: 2, trackName: "Amazing Grace", artistName: "John Newton", albumName: "Other", plainLyrics: song },
      { id: 3, trackName: "Quiet", artistName: "X", instrumental: true, plainLyrics: "" },
      { id: 4, trackName: "No words", artistName: "Y", plainLyrics: null },
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.title).toBe("Amazing Grace");
    expect(hits[0]!.verdict).toBe("good");
    expect(parseSongSearch("nope")).toEqual([]);
  });
});
