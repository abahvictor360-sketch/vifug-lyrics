/**
 * Run with: bun test src/web/lib/verse-rank.test.ts
 *
 * Uses the real King James text shipped in public/bible, because a ranking that
 * only works on a toy corpus proves nothing. The negatives matter more than the
 * positives: ordinary sermon sentences must not land on a verse.
 */
import { beforeAll, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { buildCorpus, type VerseCorpus } from "./quoted-verse";
import { rankVerses } from "./verse-rank";

let corpus: VerseCorpus;

beforeAll(() => {
  const dir = path.join(import.meta.dir, "../../../public/bible/kjv");
  const rows: { code: string; name: string; chapter: number; verse: number; text: string }[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const code = f.replace(".json", "");
    const data = JSON.parse(readFileSync(path.join(dir, f), "utf8")) as { c: Record<string, string[]> };
    for (const [ch, verses] of Object.entries(data.c)) {
      verses.forEach((text, i) => text && rows.push({ code, name: code, chapter: Number(ch), verse: i + 1, text }));
    }
  }
  corpus = buildCorpus("kjv", rows);
});

const ref = (c: { name: string; chapter: number; verse: number }) => `${c.name} ${c.chapter}:${c.verse}`;

test("a modern paraphrase of Matthew 6:6 finds it (the example from the Pewbeam video)", () => {
  const top = rankVerses(
    "when you pray go into your room and shut the door and pray to your father who is in secret and he will reward you openly",
    corpus,
  );
  expect(top.length).toBeGreaterThan(0);
  expect(ref(top[0]!)).toBe("MAT 6:6");
  expect(top[0]!.confidence).toBeGreaterThanOrEqual(70);
});

test("a short, partial paraphrase still finds Matthew 6:6", () => {
  const top = rankVerses("prayer in secret will reward you openly", corpus, { minShared: 3 });
  expect(top.map(ref)).toContain("MAT 6:6");
});

test("John 3:16 in modern words", () => {
  const top = rankVerses(
    "God loved the world so much that he gave his only son so that whoever believes in him will not perish but have eternal life",
    corpus,
  );
  expect(ref(top[0]!)).toBe("JHN 3:16");
});

test("more modern paraphrases, each ranked first in the King James text", () => {
  const cases: [string, string][] = [
    ["ROM 8:28", "we know that God works all things together for good for those who love him and are called according to his purpose"],
    ["PRO 3:5", "trust in the lord with all your heart and do not lean on your own understanding"],
    ["EPH 2:8", "for it is by grace you have been saved through faith and this is not from yourselves it is the gift of god"],
    ["MAT 28:19", "go and make disciples of all nations baptizing them in the name of the father and of the son and of the holy spirit"],
  ];
  for (const [want, said] of cases) {
    const top = rankVerses(said, corpus, { minShared: 3 });
    expect(ref(top[0]!)).toBe(want.replace(" ", " "));
  }
});

/*
 * What it cannot do, so nobody expects it to: it matches WORDS, not meaning.
 * "The Lord is my shepherd and I will lack nothing" shares one rare word with
 * "...I shall not want"; "love is patient" shares nothing with the King
 * James's "charity suffereth long". Those are misses, by design - a miss shows
 * nothing, and the preacher saying a reference or reading the verse still
 * works. Choosing a Bible version that uses the preacher's wording closes most
 * of the gap, because it ranks against whichever version is selected.
 */

test("ordinary sermon sentences land on nothing worth showing", () => {
  const talk = [
    "welcome everyone to church this morning we are so glad to see you all here today",
    "if you can hear me say amen and turn to your neighbor and give them a smile",
    "let us stand together and open our hearts as we begin the service this morning",
    "i want to thank the ushers and the choir and everyone who prepared for this day",
  ];
  for (const s of talk) {
    const top = rankVerses(s, corpus);
    const best = top[0]?.confidence ?? 0;
    expect(best).toBeLessThan(70);
  }
});

test("returns nothing for too little to go on", () => {
  expect(rankVerses("amen", corpus)).toEqual([]);
  expect(rankVerses("", corpus)).toEqual([]);
});

test("candidates are ordered best first and capped at k", () => {
  const top = rankVerses("pray to your father in secret and he will reward you openly", corpus, { k: 3 });
  expect(top.length).toBeLessThanOrEqual(3);
  for (let i = 1; i < top.length; i++) expect(top[i - 1]!.score).toBeGreaterThanOrEqual(top[i]!.score);
});

test("fast enough to run on speech still being spoken", () => {
  const sentence = "when you pray go into your room and shut the door and pray to your father who is in secret";
  rankVerses(sentence, corpus); // warm the weight cache, as a real sermon would after a few seconds
  const runs = 50;
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) rankVerses(sentence, corpus);
  const per = (performance.now() - t0) / runs;
  console.log(`rankVerses: ${per.toFixed(2)} ms per sentence over ${corpus.text.length} verses`);
  expect(per).toBeLessThan(40);
});
