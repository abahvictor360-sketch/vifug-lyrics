import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { parseBibleFile, makeBookResolver } from "./bible-parse";

const canon = JSON.parse(readFileSync(new URL("../../../public/bible/manifest.json", import.meta.url), "utf8")).canon;

describe("bible-parse", () => {
  it("resolves names, codes, osis ids and numbers", () => {
    const r = makeBookResolver(canon);
    expect(r("Genesis")).toBe("GEN");
    expect(r("1 John")).toBe("1JN");
    expect(r("I Corinthians")).toBe("1CO");
    expect(r("Ps")).toBe("PSA");
    expect(r("Song of Solomon")).toBe("SNG");
    expect(r("John")).toBe("JHN");
    expect(r(43)).toBe("JHN");
    expect(r("Nonsense")).toBeNull();
  });

  it("reads reference-per-line text", () => {
    const p = parseBibleFile(
      "Genesis 1:1 In the beginning God created.\nGenesis 1:2 And the earth was void.\nJohn 3:16\tFor God so loved the world.\nthis line is junk",
      "x.txt",
      canon,
    );
    expect(p.books.GEN!.c["1"]).toEqual(["In the beginning God created.", "And the earth was void."]);
    expect(p.books.JHN!.c["3"]![15]).toBe("For God so loved the world.");
    expect(p.verseCount).toBe(3);
    expect(p.warnings.join(" ")).toContain("1 line");
  });

  it("reads CSV with quotes", () => {
    const p = parseBibleFile('Book,Chapter,Verse,Text\nRuth,1,1,"In the days when the judges ruled"\n', "x.csv", canon);
    expect(p.books.RUT!.c["1"]![0]).toBe("In the days when the judges ruled");
  });

  it("reads JSON arrays and nested shapes", () => {
    const a = parseBibleFile(JSON.stringify([{ book: "Genesis", chapter: 1, verse: 1, text: "A" }, { book: 2, chapter: 1, verse: 1, text: "B" }]), "a.json", canon);
    expect(a.books.GEN!.c["1"]).toEqual(["A"]);
    expect(a.books.EXO!.c["1"]).toEqual(["B"]);
    const b = parseBibleFile(JSON.stringify({ GEN: { c: { "1": ["x", "y"] } } }), "b.json", canon);
    expect(b.books.GEN!.c["1"]).toEqual(["x", "y"]);
  });

  it("reads OSIS and Zefania XML", () => {
    const o = parseBibleFile('<osis><verse osisID="Gen.1.1">In the beginning<note>n</note></verse><verse osisID="Ps.23.1">The Lord is my shepherd</verse></osis>', "a.xml", canon);
    expect(o.books.GEN!.c["1"]![0]).toBe("In the beginning");
    expect(o.books.PSA!.c["23"]![0]).toBe("The Lord is my shepherd");
    const z = parseBibleFile('<XMLBIBLE><BIBLEBOOK bnumber="43"><CHAPTER cnumber="3"><VERS vnumber="16">For God so loved</VERS></CHAPTER></BIBLEBOOK></XMLBIBLE>', "z.xml", canon);
    expect(z.books.JHN!.c["3"]![15]).toBe("For God so loved");
  });

  it("reports a bad file instead of throwing", () => {
    const p = parseBibleFile("{not json", "bad.json", canon);
    expect(p.verseCount).toBe(0);
    expect(p.warnings.length).toBeGreaterThan(0);
  });
});
