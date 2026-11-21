/**
 * Run with: bun test src/web/lib/bible-search.test.ts
 * Uses the real King James text in public/bible, for the same reason verse-rank.test.ts does.
 */
import { beforeAll, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { buildCorpus, type VerseCorpus } from "./quoted-verse";
import { matchSpans, searchCorpus } from "./bible-search";

let corpus: VerseCorpus;
const raw = new Map<string, string>();

beforeAll(() => {
  const dir = path.join(import.meta.dir, "../../../public/bible/kjv");
  const rows: { code: string; name: string; chapter: number; verse: number; text: string }[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const code = f.replace(".json", "");
    const data = JSON.parse(readFileSync(path.join(dir, f), "utf8")) as { c: Record<string, string[]> };
    for (const [ch, verses] of Object.entries(data.c)) {
      verses.forEach((text, i) => {
        if (!text) return;
        rows.push({ code, name: code, chapter: Number(ch), verse: i + 1, text });
        raw.set(`${code} ${ch}:${i + 1}`, text);
      });
    }
  }
  corpus = buildCorpus("kjv", rows);
});

const ref = (i: number) => `${corpus.code[i]} ${corpus.chapter[i]}:${corpus.verse[i]}`;
const top = (q: string, n = 5) => searchCorpus(corpus, q, 60).slice(0, n).map((h) => `${ref(h.index)}:${h.kind}`);

test("a remembered sentence finds its verse, whatever the punctuation, capitals or spacing", () => {
  expect(top("for god so loved the world", 1)).toEqual(["JHN 3:16:phrase"]);
  expect(top("For God, so loved the WORLD!", 1)).toEqual(["JHN 3:16:phrase"]);
  expect(top("  god so loved the world that he gave his only begotten son ", 1)).toEqual(["JHN 3:16:phrase"]);
});

test("it finds the verse while the last word is still being typed", () => {
  expect(top("for god so loved the wor", 1)).toEqual(["JHN 3:16:phrase"]);
  expect(top("the lord is my shep", 1)).toEqual(["PSA 23:1:phrase"]);
});

test("a line that runs over a verse break brings both verses, the first marked as continuing", () => {
  const hits = searchCorpus(corpus, "i shall not want he maketh me to lie down");
  const refs = hits.map((h) => ref(h.index));
  expect(refs.slice(0, 2)).toEqual(["PSA 23:1", "PSA 23:2"]);
  expect(hits[0]!.continues).toBe(true);
  expect(hits[1]!.continues).toBeUndefined();
});

test("a paraphrase is found as a close match, after the exact ones", () => {
  const found = top("God loved the world so much that he gave his only son", 10);
  expect(found.some((x) => x.startsWith("JHN 3:16"))).toBe(true);
  const kinds = searchCorpus(corpus, "God loved the world so much that he gave his only son").map((h) => h.kind);
  // exact phrase matches never come after a looser kind
  const firstLoose = kinds.findIndex((k) => k !== "phrase");
  expect(firstLoose === -1 || kinds.slice(firstLoose).every((k) => k !== "phrase")).toBe(true);
});

test("the same words in a different order are found, last", () => {
  const hits = searchCorpus(corpus, "shepherd lord my");
  expect(hits.map((h) => ref(h.index))).toContain("PSA 23:1");
  expect(hits.find((h) => ref(h.index) === "PSA 23:1")!.kind).toBe("words");
});

test("one word still finds every verse that has it", () => {
  const hits = searchCorpus(corpus, "shepherd", 500);
  expect(hits.length).toBeGreaterThan(40);
  expect(hits.every((h) => corpus.text[h.index]!.includes("shepherd"))).toBe(true);
});

test("nonsense finds nothing, and a tiny query is ignored", () => {
  expect(searchCorpus(corpus, "zzzqqq xxyyzz")).toEqual([]);
  expect(searchCorpus(corpus, "a")).toEqual([]);
});

test("a common phrase returns the best fit first, not whatever comes first in Genesis", () => {
  const hits = searchCorpus(corpus, "and it came to pass");
  expect(hits.length).toBe(60); // capped
  // ranked by how much of the verse the phrase is, so the first answer is mostly the phrase
  expect(hits[0]!.score).toBeGreaterThanOrEqual(hits[hits.length - 1]!.score);
});

test("it is fast enough to run as someone types", () => {
  const t = performance.now();
  for (let i = 0; i < 10; i++) searchCorpus(corpus, "for god so loved the world that he gave");
  expect((performance.now() - t) / 10).toBeLessThan(100);
});

test("matchSpans marks the exact phrase as printed, commas and capitals included", () => {
  const text = raw.get("JHN 3:16")!;
  const spans = matchSpans(text, "god so loved the world", "phrase");
  expect(spans).toHaveLength(1);
  expect(text.slice(spans[0]![0], spans[0]![1])).toBe("God so loved the world");
});

test("matchSpans for a looser match marks only the words that were asked for", () => {
  const text = "The Lord is my shepherd; I shall not want.";
  const spans = matchSpans(text, "shepherd lord", "words").map(([s, e]) => text.slice(s, e));
  expect(spans).toEqual(["Lord", "shepherd"]);
});

test("matchSpans marks a common word only when it sits beside another asked-for word", () => {
  const text = "The Lord is my shepherd; I shall not want the thing.";
  const spans = matchSpans(text, "the lord shepherd", "words").map(([s, e]) => text.slice(s, e));
  expect(spans).toContain("The Lord"); // "the" beside "lord"
  expect(spans).not.toContain("the"); // the later, lonely "the" is not marked
});
