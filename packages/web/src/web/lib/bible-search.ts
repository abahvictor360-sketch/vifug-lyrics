/**
 * Finding a sentence in the Bible.
 *
 * Someone remembers a line - "for God so loved the world", "the Lord is my
 * shepherd", "I can do all things through Christ" - and wants the reference.
 * They will not type it the way the page prints it: no commas, no capitals,
 * half of the last word still to come. The old search was a plain
 * `includes()` on the raw verse, so a missing comma found nothing, and it
 * stopped at the first sixty verses in book order, which for a common phrase
 * meant Genesis whatever the question.
 *
 * This works on the same normalised corpus auto-follow uses, in three passes
 * that are merged in order of how sure each is:
 *
 *   1. phrase  - the words, in that order, exactly as typed (punctuation and
 *                capitals ignored, the last word may be unfinished). A line that
 *                runs over a verse break is found too, and both verses come back.
 *   2. similar - the wording is close but not identical (a paraphrase, or one
 *                word different), ranked by how rare the shared words are.
 *   3. words   - every word is in the verse, in any order.
 *
 * A single word keeps its old meaning: any verse containing it.
 */
import { normaliseVerse, type VerseCorpus } from "./quoted-verse";
import { rankVerses } from "./verse-rank";

export type SearchKind = "phrase" | "similar" | "words";

export type RankedHit = {
  /** Position in the corpus. */
  index: number;
  kind: SearchKind;
  score: number;
  /** True for the first verse of a phrase that carries on into the next one. */
  continues?: boolean;
};

/** Words too common to be worth highlighting on their own. */
const STOP = new Set(
  "a an and are as at be but by for from had has have he her him his i if in is it its me my no not of on or our she so that the their them they this to unto was we were what when which who will with ye you your thou thee thy shall".split(" "),
);

/** The verses worth looking at: those holding the rarest of these words. */
function narrowest(words: string[], corpus: VerseCorpus): number[] | null {
  let best: number[] | null = null;
  for (const w of words) {
    const list = corpus.index.get(w);
    if (!list || list.length === 0 || list[0] === -1) continue;
    if (!best || list.length < best.length) best = list;
  }
  return best;
}

const sameChapter = (c: VerseCorpus, a: number, b: number) =>
  a >= 0 && b < c.text.length && c.code[a] === c.code[b] && c.chapter[a] === c.chapter[b];

export function searchCorpus(corpus: VerseCorpus, rawQuery: string, limit = 60): RankedHit[] {
  const q = normaliseVerse(rawQuery);
  if (q.length < 2) return [];
  const words = q.split(" ").filter(Boolean);
  const total = corpus.text.length;

  // One word: any verse that contains it, as the search always did.
  if (words.length === 1) {
    const out: RankedHit[] = [];
    for (let i = 0; i < total && out.length < limit; i++) {
      if (corpus.text[i]!.includes(q)) out.push({ index: i, kind: "phrase", score: 1 });
    }
    return out;
  }

  // The last word may still be being typed, so it only has to START a word.
  const needle = ` ${q}`;
  const settled = words.slice(0, -1); // whole words; these can narrow the scan
  const candidates = narrowest(settled, corpus);
  const scan = (fn: (i: number) => void) => {
    if (candidates) for (const i of candidates) fn(i);
    else for (let i = 0; i < total; i++) fn(i);
  };

  const seen = new Set<number>();
  const phrase: RankedHit[] = [];
  scan((i) => {
    const t = corpus.text[i]!;
    if (t.includes(needle)) {
      // A verse that is mostly the phrase is a better answer than one that merely contains it.
      phrase.push({ index: i, kind: "phrase", score: q.length / Math.max(1, t.length - 2) });
      seen.add(i);
    }
  });
  phrase.sort((a, b) => b.score - a.score || a.index - b.index);

  // A line that runs over a verse break: the phrase is in neither verse alone.
  const spanning: RankedHit[] = [];
  if (candidates) {
    const tried = new Set<number>();
    for (const c of candidates) {
      for (const a of [c - 1, c]) {
        const b = a + 1;
        if (tried.has(a) || !sameChapter(corpus, a, b) || seen.has(a) || seen.has(b)) continue;
        tried.add(a);
        const joined = ` ${corpus.text[a]!.trim()} ${corpus.text[b]!.trim()} `;
        if (joined.includes(needle)) {
          spanning.push({ index: a, kind: "phrase", score: 0.5, continues: true });
          spanning.push({ index: b, kind: "phrase", score: 0.5 });
          seen.add(a);
          seen.add(b);
        }
      }
    }
  }

  const ordered: RankedHit[] = [...phrase, ...spanning];

  if (ordered.length < limit && words.length >= 3) {
    const ranked = rankVerses(rawQuery, corpus, {
      k: limit,
      minShared: Math.min(4, Math.max(2, words.length - 1)),
      minPrecision: 0.5,
    });
    for (const r of ranked) {
      const i = r.index;
      if (i === undefined || seen.has(i)) continue;
      ordered.push({ index: i, kind: "similar", score: r.score });
      seen.add(i);
    }
  }

  if (ordered.length < limit) {
    const found: RankedHit[] = [];
    const all = [...settled.map((w) => ` ${w} `), ` ${words[words.length - 1]}`];
    scan((i) => {
      if (seen.has(i)) return;
      const t = corpus.text[i]!;
      if (all.every((w) => t.includes(w))) found.push({ index: i, kind: "words", score: words.length / Math.max(1, t.split(" ").length) });
    });
    found.sort((a, b) => b.score - a.score || a.index - b.index);
    ordered.push(...found);
  }

  return ordered.slice(0, limit);
}

/**
 * Where, in the verse as printed, the matching words are, so the result list
 * can show why a verse was found. Ranges are character offsets into `text`.
 */
export function matchSpans(text: string, rawQuery: string, kind: SearchKind): [number, number][] {
  const qWords = normaliseVerse(rawQuery).split(" ").filter(Boolean);
  if (!qWords.length) return [];
  const toks: { s: number; e: number; w: string }[] = [];
  const re = /[\p{L}\p{N}][\p{L}\p{N}’']*/gu;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    toks.push({ s: m.index, e: m.index + m[0].length, w: normaliseVerse(m[0]) });
  }
  const lastIdx = qWords.length - 1;

  // The exact phrase is one unbroken stretch.
  if (kind === "phrase" && qWords.length > 1) {
    for (let i = 0; i + qWords.length <= toks.length; i++) {
      let ok = true;
      for (let j = 0; j < qWords.length && ok; j++) {
        const w = toks[i + j]!.w;
        ok = j === lastIdx ? w.startsWith(qWords[j]!) : w === qWords[j];
      }
      if (ok) return [[toks[i]!.s, toks[i + qWords.length - 1]!.e]];
    }
  }

  // Otherwise: the query's words, where a common word counts only beside another one.
  const set = new Set(qWords);
  const hit = toks.map((t) => set.has(t.w) || (qWords.length === 1 && t.w.startsWith(qWords[0]!)));
  const spans: [number, number][] = [];
  let run: [number, number] | null = null;
  toks.forEach((t, i) => {
    const solid = hit[i] && (!STOP.has(t.w) || hit[i - 1] || hit[i + 1]);
    if (solid) {
      if (run) run[1] = t.e;
      else run = [t.s, t.e];
    } else if (run) {
      spans.push(run);
      run = null;
    }
  });
  if (run) spans.push(run);
  return spans;
}
