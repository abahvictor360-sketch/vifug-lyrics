/**
 * Which verse is this PARAPHRASE of?
 *
 * quoted-verse.ts answers "the preacher read the verse out" and is deliberately
 * strict: a long, exact, unique run of words, or nothing. Most of a sermon is
 * not that. "When you pray, go into your room, shut the door and pray to your
 * Father in secret, and he will reward you openly" is Matthew 6:6 to anyone in
 * the room and shares almost no six-word run with the King James text.
 *
 * So this ranks instead of deciding. It scores every verse that shares rare
 * words with the sentence and hands back the best few, each with a confidence,
 * and says nothing when nothing scores well. What to do with a candidate - cue
 * it to Preview, list it for the operator to Present - is the caller's call;
 * a paraphrase is a guess and is treated as one.
 *
 * How it scores: words are weighted by how rare they are across the whole Bible
 * (the same idea as TF-IDF), so "reward", "openly" and "closet" carry the
 * sentence and "the", "and", "you" barely count. A verse scores well when most
 * of what was SAID is found in it (precision) and a fair part of the verse was
 * said (recall), with precision counting for more because a preacher quotes
 * part of a verse far more often than a verse plus extra.
 *
 * Fast on purpose: it runs on speech still being spoken. It only ever looks at
 * the verses holding the sentence's rare words, never the whole Bible.
 */
import { normaliseVerse, type VerseCorpus } from "./quoted-verse";

export type VerseCandidate = {
  /** Position in the corpus the candidate came from. */
  index?: number;
  code: string;
  name: string;
  chapter: number;
  verse: number;
  /** 0 - 1, how well the sentence matches this verse. */
  score: number;
  /** The same as a percentage an operator can read. Never above 97: only a cited reference earns 100. */
  confidence: number;
};

/** A word the Bible's index dropped as too common to narrow anything down. */
const COMMON_WEIGHT = 0.35;
/** A word that is not in this Bible at all ("okay", "internet"): says nothing, but was said. */
const UNKNOWN_WEIGHT = 0.6;
/** How many candidates are scored in full; the rest cannot beat them. */
const SHORTLIST = 40;

const weightCache = new WeakMap<VerseCorpus, Map<string, number>>();

function weightOf(corpus: VerseCorpus, word: string): number {
  let cache = weightCache.get(corpus);
  if (!cache) {
    cache = new Map();
    weightCache.set(corpus, cache);
  }
  const hit = cache.get(word);
  if (hit !== undefined) return hit;
  const list = corpus.index.get(word);
  let w: number;
  if (!list || list.length === 0) w = UNKNOWN_WEIGHT;
  else if (list[0] === -1) w = COMMON_WEIGHT;
  else w = Math.min(9, Math.max(1, Math.log(corpus.text.length / list.length)));
  cache.set(word, w);
  return w;
}

export function rankVerses(
  sentence: string,
  corpus: VerseCorpus,
  opts: {
    /** How many candidates to return. */
    k?: number;
    /** Rare words the verse and the sentence must share. */
    minShared?: number;
    /** Share of the sentence's weight that must be found in the verse. */
    minPrecision?: number;
  } = {},
): VerseCandidate[] {
  const { k = 4, minShared = 4, minPrecision = 0.55 } = opts;
  const words = [...new Set(normaliseVerse(sentence).split(" ").filter(Boolean))];
  if (words.length < minShared + 1) return [];

  let queryWeight = 0;
  const acc = new Map<number, number>();
  const shared = new Map<number, number>();
  for (const w of words) {
    const wt = weightOf(corpus, w);
    queryWeight += wt;
    const list = corpus.index.get(w);
    // Only words the index kept can nominate a verse; common ones are scored
    // for the shortlist below.
    if (!list || list.length === 0 || list[0] === -1) continue;
    for (const i of list) {
      acc.set(i, (acc.get(i) ?? 0) + wt);
      shared.set(i, (shared.get(i) ?? 0) + 1);
    }
  }
  if (acc.size === 0 || queryWeight === 0) return [];

  // The shortlist: highest rare-word weight first. Scoring every verse that
  // shares one word would be thousands of full scorings for no gain.
  const shortlist = [...acc.entries()]
    .filter(([i]) => (shared.get(i) ?? 0) >= minShared)
    .sort((a, b) => b[1] - a[1])
    .slice(0, SHORTLIST);

  const out: VerseCandidate[] = [];
  for (const [i] of shortlist) {
    const verseWords = [...new Set(corpus.text[i]!.split(" ").filter(Boolean))];
    let verseWeight = 0;
    for (const vw of verseWords) verseWeight += weightOf(corpus, vw);
    let overlap = 0;
    for (const w of words) if (corpus.text[i]!.includes(` ${w} `)) overlap += weightOf(corpus, w);
    const precision = overlap / queryWeight;
    const recall = overlap / verseWeight;
    if (precision < minPrecision) continue;
    const score = Math.pow(precision, 0.65) * Math.pow(Math.min(1, recall * 1.6), 0.35);
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
