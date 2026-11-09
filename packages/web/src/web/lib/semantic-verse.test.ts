import { describe, expect, it } from "bun:test";
import { mergeCandidates, quantise, semanticScore, topK } from "./semantic-verse";
import type { VerseCorpus } from "./quoted-verse";

const corpus = {
  code: ["psa", "jhn", "mat"],
  name: ["Psalms", "John", "Matthew"],
  chapter: [23, 3, 6],
  verse: [4, 16, 6],
} as unknown as VerseCorpus;

describe("semantic-verse", () => {
  it("ranks the nearest vector first", () => {
    const dim = 4;
    const m = new Int8Array([...quantise([1, 0, 0, 0]), ...quantise([0, 1, 0, 0]), ...quantise([0.7, 0.7, 0, 0])]);
    const hits = topK(new Float32Array([0, 1, 0, 0]), m, 2, dim);
    expect(hits[0]![0]).toBe(1);
    expect(hits[0]![1]).toBeGreaterThan(0.95);
    expect(hits[1]![0]).toBe(2);
  });

  it("maps cosine to a monotonic score", () => {
    expect(semanticScore(0.2)).toBe(0);
    expect(semanticScore(0.6)).toBeGreaterThan(semanticScore(0.5));
    expect(semanticScore(1)).toBeLessThanOrEqual(0.95);
  });

  it("trusts agreement and drops weak semantic guesses", () => {
    const lex = [{ index: 0, code: "psa", name: "Psalms", chapter: 23, verse: 4, score: 0.6, confidence: 60 }];
    const out = mergeCandidates(lex, [[0, 0.7], [1, 0.45], [2, 0.8]], corpus);
    expect(out[0]!.index === 0 || out[0]!.index === 2).toBe(true);
    expect(out.find((c) => c.index === 1)).toBeUndefined();
    const both = out.find((c) => c.index === 0)!;
    expect(both.score).toBeGreaterThan(0.6);
    expect(both.confidence).toBeLessThanOrEqual(97);
  });
});
