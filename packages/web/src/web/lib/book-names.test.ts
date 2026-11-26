import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { parseReference, type BibleManifest } from "../hooks/use-bible";
import { bookNameForAlias, normaliseBookText } from "./book-names";

const manifest = JSON.parse(readFileSync(new URL("../../../public/bible/manifest.json", import.meta.url), "utf8")) as BibleManifest;
const ref = (q: string) => {
  const r = parseReference(q, manifest);
  return r && `${r.code} ${r.chapter}:${r.verse}${r.endVerse ? `-${r.endVerse}` : ""}`;
};

describe("Roman and spelled-out numbers", () => {
  it.each([
    ["i cor 4 4", "1CO 4:4"],
    ["II Kings 2 11", "2KI 2:11"],
    ["iii john 1 4", "3JN 1:4"],
    ["ii. tim 3 16", "2TI 3:16"],
    ["1st john 3 16", "1JN 3:16"],
    ["first john 1 9", "1JN 1:9"],
    ["Second Peter 3 9", "2PE 3:9"],
    ["3rd john 1 2", "3JN 1:2"],
  ])("%s", (q, want) => expect(ref(q)).toBe(want));

  it("does not read the start of a name as a numeral", () => {
    expect(ref("isaiah 53 5")).toBe("ISA 53:5");
    expect(ref("isa 53 5")).toBe("ISA 53:5");
    expect(ref("ephesians 2 8")).toBe("EPH 2:8");
    expect(normaliseBookText("Isaiah")).toBe("isaiah");
  });
});

describe("standard abbreviations", () => {
  it.each([
    ["1kgs 3 9", "1KI 3:9"],
    ["2kgs 5 14", "2KI 5:14"],
    ["1ki 3 9", "1KI 3:9"],
    ["1sam 17 4", "1SA 17:4"],
    ["2sm 7 12", "2SA 7:12"],
    ["1chr 4 10", "1CH 4:10"],
    ["1thess 4 16", "1TH 4:16"],
    ["2tim 3 16", "2TI 3:16"],
    ["1pt 2 9", "1PE 2:9"],
    ["1jn 1 9", "1JN 1:9"],
    ["1 jn 1 9", "1JN 1:9"],
    ["jn 3 16", "JHN 3:16"],
    ["mk 10 45", "MRK 10:45"],
    ["lk 2 11", "LUK 2:11"],
    ["mt 5 3", "MAT 5:3"],
    ["rv 21 4", "REV 21:4"],
    ["phlm 1 6", "PHM 1:6"],
    ["sos 2 4", "SNG 2:4"],
    ["dt 6 4", "DEU 6:4"],
    ["jdg 6 12", "JDG 6:12"],
    ["jl 2 28", "JOL 2:28"],
    ["zech 4 6", "ZEC 4:6"],
    ["hb 2 4", "HAB 2:4"],
    ["jb 19 25", "JOB 19:25"],
  ])("%s", (q, want) => expect(ref(q)).toBe(want));

  it("still understands everything it did before", () => {
    expect(ref("John 3:16")).toBe("JHN 3:16");
    expect(ref("john 3 16")).toBe("JHN 3:16");
    expect(ref("1 John 2:3-5")).toBe("1JN 2:3-5");
    expect(ref("Gen 1")).toBe("GEN 1:1");
    expect(ref("ps 23.1")).toBe("PSA 23:1");
    expect(ref("john 3v16")).toBe("JHN 3:16");
    expect(ref("1cor 4 4")).toBe("1CO 4:4");
    expect(ref("1 corinthians 13 4")).toBe("1CO 13:4");
    expect(ref("psalm 23")).toBe("PSA 23:1");
    expect(ref("song of solomon 2 4")).toBe("SNG 2:4");
    expect(ref("rev 22 21")).toBe("REV 22:21");
    expect(ref("jude 1 3")).toBe("JUD 1:3");
    expect(ref("phil 4 13")).toBe("PHP 4:13");
    expect(ref("ex 20 3")).toBe("EXO 20:3");
  });

  it("leaves ambiguous or unknown words alone", () => {
    expect(bookNameForAlias("jo")).toBeNull();
    expect(bookNameForAlias("ph")).toBeNull();
    expect(ref("hello 3 4")).toBeNull();
    expect(ref("4kgs 3 9")).toBeNull();
  });

  it("every alias points at a book that exists in the canon", () => {
    const names = new Set(manifest.canon.map((b) => b.name));
    for (const q of ["1kgs", "2kgs", "jn", "sos", "rv", "1pt", "3jn", "phlm", "zp", "apocalypse"]) {
      expect(names.has(bookNameForAlias(q)!), q).toBe(true);
    }
  });
});
