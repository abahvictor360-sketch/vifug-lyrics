/**
 * A last look at imported words before they reach the operator.
 *
 * Extraction (html-to-lyrics.ts) decides WHERE on a page the song is. This
 * decides whether what it found is a song, and tidies what is left the way a
 * person copying it by hand would: no chord charts, no timestamps, no page
 * printed twice, no "Lyrics" heading above the words. Anything it changes is
 * reported, so the import screen can say what was done rather than silently
 * editing someone's text.
 *
 * Conservative by design: a lyric line is never dropped for being odd, only
 * for matching a shape that cannot be a sung line.
 */

export type LyricsVet = {
  text: string;
  /** What was taken out, human-readable, for the import screen. */
  changes: string[];
  /** Reasons the result may not be a clean song. */
  warnings: string[];
  verdict: "good" | "check" | "poor";
};

const CHORD = "[A-G](?:#|b)?(?:maj|min|m|M|sus|dim|aug|add)?\\d{0,2}(?:/[A-G](?:#|b)?)?";
const CHORD_ONLY = new RegExp(`^\\s*(?:\\(?${CHORD}\\)?\\s*[-|.]?\\s*)+$`);
const INLINE_CHORD = new RegExp(`\\[${CHORD}\\]`, "g");
const TIMESTAMP = /^\s*\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]\s*/;
const REPEAT_MARK = /^\s*[\[(]?\s*(?:x\s?\d+|\d+\s?x|repeat(?: \d+ times?)?|chorus x\d+)\s*[\])]?\s*$/i;

function normLine(l: string): string {
  return l.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function vetLyrics(raw: string, opts: { title?: string } = {}): LyricsVet {
  const changes: string[] = [];
  const warnings: string[] = [];
  let lines = raw.replace(/\r/g, "").split("\n");

  // LRC-style timestamps: "[00:12.30] words" -> "words".
  const stamped = lines.filter((l) => TIMESTAMP.test(l)).length;
  if (stamped) {
    lines = lines.map((l) => l.replace(TIMESTAMP, ""));
    changes.push(`Removed timestamps from ${stamped} line${stamped === 1 ? "" : "s"}.`);
  }

  // Inline chord markers: "[G]Amazing [D]grace".
  const inline = lines.filter((l) => INLINE_CHORD.test(l)).length;
  INLINE_CHORD.lastIndex = 0;
  if (inline) {
    lines = lines.map((l) => l.replace(INLINE_CHORD, ""));
    changes.push("Removed chord markers.");
  }

  // Chord-only lines from a chord chart ("G   D   Em   C").
  const beforeChords = lines.length;
  lines = lines.filter((l) => !(l.trim().length > 0 && CHORD_ONLY.test(l.trim()) && l.trim().length <= 60 && /[A-G]/.test(l)));
  const chordLines = beforeChords - lines.length;
  if (chordLines) changes.push(`Removed ${chordLines} chord line${chordLines === 1 ? "" : "s"}.`);

  // "x2" / "repeat" markers on their own line.
  const marks = lines.filter((l) => REPEAT_MARK.test(l)).length;
  if (marks) {
    lines = lines.filter((l) => !REPEAT_MARK.test(l));
    changes.push(`Removed ${marks} repeat marker${marks === 1 ? "" : "s"} (repeat the section yourself if you want it twice).`);
  }

  // The page's own heading echoed at the top: "Amazing Grace", "Amazing Grace Lyrics".
  const title = normLine(opts.title ?? "");
  if (title) {
    let i = 0;
    while (i < lines.length && lines[i]!.trim() === "") i++;
    const first = normLine(lines[i] ?? "");
    if (first && (first === title || first === `${title} lyrics` || first === `lyrics ${title}`)) {
      lines.splice(i, 1);
      changes.push("Removed the title line above the words.");
    }
  }

  let text = lines.join("\n").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();

  // The whole song printed twice (a mobile and a desktop copy on one page).
  const paras = text.split(/\n{2,}/);
  if (paras.length >= 4 && paras.length % 2 === 0) {
    const half = paras.length / 2;
    const a = paras.slice(0, half).map(normLine).join("|");
    const b = paras.slice(half).map(normLine).join("|");
    if (a === b) {
      text = paras.slice(0, half).join("\n\n");
      changes.push("The page printed the song twice; kept one copy.");
    }
  }

  // Is it a song at all?
  const real = text.split("\n").filter((l) => l.trim());
  let verdict: LyricsVet["verdict"] = "good";
  if (real.length < 4) {
    warnings.push("Only a few lines came back - that may be a snippet rather than the whole song.");
    verdict = "check";
  }
  if (real.length) {
    const words = real.map((l) => l.trim().split(/\s+/).length);
    const long = words.filter((w) => w > 18).length / real.length;
    const avg = words.reduce((a, b) => a + b, 0) / real.length;
    if (long > 0.3 || avg > 16) {
      warnings.push("The text reads like paragraphs of prose, not sung lines - it may be an article or a page of notes.");
      verdict = "poor";
    }
    const uniq = new Set(real.map(normLine)).size;
    if (real.length >= 12 && uniq / real.length < 0.25) {
      warnings.push("Almost every line is a repeat - check that nothing was duplicated by the page.");
      if (verdict === "good") verdict = "check";
    }
    const nonAlpha = real.filter((l) => !/[A-Za-zÀ-ɏЀ-ӿ؀-ۿ]/.test(l)).length / real.length;
    if (nonAlpha > 0.2) {
      warnings.push("Many lines have no letters in them - check for stray symbols.");
      if (verdict === "good") verdict = "check";
    }
  } else {
    verdict = "poor";
    warnings.push("Nothing was left after tidying.");
  }
  return { text, changes, warnings, verdict };
}

/** What a LRCLIB-style search hit gives us, trimmed to what the picker needs. */
export type SongHit = {
  id: string;
  title: string;
  artist: string;
  album: string;
  /** Plain lyrics, already vetted. Empty when the source has none for this song. */
  text: string;
  verdict: LyricsVet["verdict"];
  changes: string[];
  warnings: string[];
  instrumental: boolean;
};

type RawLrclib = {
  id?: number | string;
  trackName?: string;
  name?: string;
  artistName?: string;
  albumName?: string;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

/** Turn the song database's JSON into vetted hits; skips instrumentals and entries without words. */
export function parseSongSearch(json: unknown, limit = 8): SongHit[] {
  if (!Array.isArray(json)) return [];
  const out: SongHit[] = [];
  const seen = new Set<string>();
  for (const r of json as RawLrclib[]) {
    if (out.length >= limit) break;
    const title = (r.trackName || r.name || "").trim();
    const artist = (r.artistName || "").trim();
    const words = (r.plainLyrics || r.syncedLyrics || "").trim();
    if (!title || !words || r.instrumental) continue;
    // The same recording is often listed once per album or release.
    const key = `${normLine(title)}|${normLine(artist)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const v = vetLyrics(words, { title });
    out.push({
      id: String(r.id ?? key),
      title,
      artist,
      album: (r.albumName || "").trim(),
      text: v.text,
      verdict: v.verdict,
      changes: v.changes,
      warnings: v.warnings,
      instrumental: false,
    });
  }
  return out;
}
