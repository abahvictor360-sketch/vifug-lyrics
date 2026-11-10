/**
 * Verses by MEANING, to sit beside verse-rank.ts which matches WORDS.
 *
 * "God is always with me, even in the darkest valley" shares no rare word run
 * with Psalm 23:4 worded "Yea, though I walk through the valley of the shadow
 * of death, I will fear no evil". A sentence-embedding model puts both near
 * each other because they mean the same thing. This file is the arithmetic
 * around that model; the model itself runs in workers/semantic-worker.ts.
 *
 * Verses are embedded once (cached on the device), then a query is one small
 * embedding and a dot product against every verse.
 */
import type { VerseCorpus } from "./quoted-verse";
import type { VerseCandidate } from "./verse-rank";

export const SEMANTIC_DIM = 384;
export const SEMANTIC_MODEL = "Xenova/all-MiniLM-L6-v2";

/** Unit vector -> int8. A quarter the memory and storage, and no visible loss of ranking. */
export function quantise(v: ArrayLike<number>): Int8Array {
  const out = new Int8Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = Math.max(-127, Math.min(127, Math.round(v[i]! * 127)));
  return out;
}

/** The k verses closest to the query, best first, as [verse index, cosine]. */
export function topK(query: Float32Array, matrix: Int8Array, k: number, dim = SEMANTIC_DIM): [number, number][] {
  const n = Math.floor(matrix.length / dim);
  const best: [number, number][] = [];
  let floor = -Infinity;
  for (let i = 0; i < n; i++) {
    let dot = 0;
    const base = i * dim;
    for (let d = 0; d < dim; d++) dot += query[d]! * matrix[base + d]!;
    const cos = dot / 127;
    if (best.length < k || cos > floor) {
      best.push([i, cos]);
      best.sort((a, b) => b[1] - a[1]);
      if (best.length > k) best.pop();
      floor = best[best.length - 1]![1];
    }
  }
  return best;
}

/**
 * Cosine similarity -> a 0-1 score comparable to the word matcher's. Sentence
 * embeddings of unrelated English text sit around 0.1-0.3; a true paraphrase of
 * a verse is typically 0.6+.
 */
export function semanticScore(cos: number): number {
  return Math.max(0, Math.min(1, (cos - 0.4) / 0.45)) * 0.95;
}

/** Below this the model is only guessing at a topic, not a verse. */
export const MIN_SEMANTIC_COSINE = 0.5;

/**
 * Fold the two rankers together. A verse both agree on is trusted more than
 * either alone; a verse only one finds still gets through on its own score.
 */
export function mergeCandidates(
  lexical: VerseCandidate[],
  semantic: [number, number][],
  corpus: VerseCorpus,
  k = 4,
): VerseCandidate[] {
  const byIndex = new Map<number, { lex?: number; sem?: number; cand?: VerseCandidate }>();
  for (const c of lexical) {
    if (c.index === undefined) continue;
    byIndex.set(c.index, { lex: c.score, cand: c });
  }
  for (const [i, cos] of semantic) {
    if (cos < MIN_SEMANTIC_COSINE) continue;
    const e = byIndex.get(i) ?? {};
    e.sem = semanticScore(cos);
    byIndex.set(i, e);
  }
  const out: VerseCandidate[] = [];
  for (const [i, e] of byIndex) {
    const base = Math.max(e.lex ?? 0, e.sem ?? 0);
    const score = e.lex !== undefined && e.sem !== undefined ? Math.min(0.97, base + 0.08) : base;
    out.push({
      index: i,
      code: corpus.code[i]!,
      name: corpus.name[i]!,
      chapter: corpus.chapter[i]!,
      verse: corpus.verse[i]!,
      score,
      confidence: Math.min(97, Math.round(score * 100)),
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, k);
}
