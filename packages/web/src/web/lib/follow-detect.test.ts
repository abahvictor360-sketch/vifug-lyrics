/**
 * Run with: bun test src/web/lib/follow-detect.test.ts
 */
import { expect, test } from "bun:test";
import { ParaphraseTracker } from "./follow-detect";
import type { VerseCandidate } from "./verse-rank";

const cand = (verse: number, confidence: number): VerseCandidate => ({
  code: "MAT", name: "Matthew", chapter: 6, verse, score: confidence / 100, confidence,
});

test("a weak candidate is never acted on", () => {
  const t = new ParaphraseTracker();
  expect(t.feed([cand(6, 50)], true, 0)).toBeNull();
  expect(t.feed([cand(6, 70)], true, 1)).toBeNull(); // worth listing, not worth cueing
});

test("an interim result must stay on top for two updates before it counts", () => {
  const t = new ParaphraseTracker();
  expect(t.feed([cand(6, 85)], false, 0)).toBeNull();      // first sighting
  const hit = t.feed([cand(6, 88)], false, 400);           // still on top
  expect(hit?.cue.verse).toBe(6);
});

test("a flickering top candidate never fires", () => {
  const t = new ParaphraseTracker();
  for (let i = 0; i < 8; i++) {
    expect(t.feed([cand(i % 2 ? 6 : 9, 85)], false, i * 400)).toBeNull();
  }
});

test("a finished sentence needs no streak", () => {
  const t = new ParaphraseTracker();
  expect(t.feed([cand(6, 85)], true, 0)?.cue.verse).toBe(6);
});

test("the same verse is not announced twice in a row, but can come back later", () => {
  const t = new ParaphraseTracker({ cooldownMs: 10_000 });
  expect(t.feed([cand(6, 85)], true, 0)).not.toBeNull();
  expect(t.feed([cand(6, 90)], true, 3_000)).toBeNull();          // still talking about it
  expect(t.feed([cand(6, 90)], true, 12_000)).not.toBeNull();     // brought up again
});

test("a different verse fires at once, and the runners-up are handed over", () => {
  const t = new ParaphraseTracker();
  t.feed([cand(6, 85)], true, 0);
  const next = t.feed([cand(9, 90), cand(10, 80), cand(11, 70)], true, 500);
  expect(next?.cue.verse).toBe(9);
  expect(next?.alternatives.map((c) => c.verse)).toEqual([10, 11]);
});

test("reset forgets everything", () => {
  const t = new ParaphraseTracker();
  t.feed([cand(6, 85)], true, 0);
  t.reset();
  expect(t.feed([cand(6, 85)], true, 1)).not.toBeNull();
});
