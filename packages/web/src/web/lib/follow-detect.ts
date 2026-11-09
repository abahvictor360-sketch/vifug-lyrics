/**
 * When is a ranked paraphrase worth acting on?
 *
 * rankVerses() answers every time it is asked, and it is asked several times a
 * second while somebody is still talking. Acting on each answer would flicker
 * the preview through every verse that shares a word with the half-sentence
 * heard so far. So this holds the line: a candidate has to be good enough, and
 * the same one has to come out on top more than once - or the sentence has to
 * have finished - before it counts, and the same verse is not announced twice
 * in a row.
 *
 * Pure, with the clock passed in, so the behaviour is testable without a
 * microphone.
 */
import type { VerseCandidate } from "./verse-rank";

export type TrackerOptions = {
  /** Below this, a candidate is not worth mentioning at all. */
  suggestAt?: number;
  /** At or above this, a candidate may be cued to Preview (or Live, if so chosen). */
  cueAt?: number;
  /** Consecutive updates the same verse must stay on top. */
  stableFor?: number;
  /** The same verse is not cued again within this long. */
  cooldownMs?: number;
};

export type Detection = {
  cue: VerseCandidate;
  /** The runners-up, for a list the operator can pick from. */
  alternatives: VerseCandidate[];
};

const keyOf = (c: VerseCandidate) => `${c.code}:${c.chapter}:${c.verse}`;

export class ParaphraseTracker {
  private readonly suggestAt: number;
  private readonly cueAt: number;
  private readonly stableFor: number;
  private readonly cooldownMs: number;
  private topKey: string | null = null;
  private streak = 0;
  private lastKey: string | null = null;
  private lastAt = 0;

  constructor(opts: TrackerOptions = {}) {
    this.suggestAt = opts.suggestAt ?? 60;
    this.cueAt = opts.cueAt ?? 75;
    this.stableFor = opts.stableFor ?? 2;
    this.cooldownMs = opts.cooldownMs ?? 20_000;
  }

  /**
   * One ranking in. A detection out when it has earned acting on, else null.
   * `final` is a finished sentence: it needs no streak, because nothing more
   * is coming to change the answer.
   */
  feed(candidates: VerseCandidate[], final: boolean, now: number): Detection | null {
    const top = candidates[0];
    if (!top || top.confidence < this.suggestAt) {
      this.topKey = null;
      this.streak = 0;
      return null;
    }
    const key = keyOf(top);
    this.streak = key === this.topKey ? this.streak + 1 : 1;
    this.topKey = key;

    if (top.confidence < this.cueAt) return null;
    if (!final && this.streak < this.stableFor) return null;
    if (key === this.lastKey && now - this.lastAt < this.cooldownMs) return null;

    this.lastKey = key;
    this.lastAt = now;
    return { cue: top, alternatives: candidates.slice(1) };
  }

  /** Forget the streak, e.g. when listening restarts. */
  reset(): void {
    this.topKey = null;
    this.streak = 0;
    this.lastKey = null;
    this.lastAt = 0;
  }
}
