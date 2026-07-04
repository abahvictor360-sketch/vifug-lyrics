/**
 * Fetch + bundle the offline Bible data into packages/web/public/bible/.
 *
 * Sources (all public-domain or openly licensed):
 *   - English (KJV, WEB, ASV, BBE): getbible.net v2 API (one JSON per book)
 *   - Yoruba / Hausa / Igbo (Biblica open license): bible.helloao.org (one JSON per chapter)
 *
 * Output layout consumed by use-bible.ts:
 *   public/bible/manifest.json          { canon, versions }
 *   public/bible/<version>/<CODE>.json  { c: { "1": ["verse 1", ...] } }
 *
 * Run: bun tools/fetch-bible.ts
 * Re-runs skip books that already exist (delete public/bible to force).
 */

import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dir, "../packages/web/public/bible");

type CanonBook = { code: string; name: string; testament: "OT" | "NT" };

// 66-book Protestant canon, in order. getbible book nr = index + 1.
// Codes are standard USFM/paratext ids (what helloao uses natively).
const CANON: CanonBook[] = [
  ["GEN", "Genesis"], ["EXO", "Exodus"], ["LEV", "Leviticus"], ["NUM", "Numbers"], ["DEU", "Deuteronomy"],
  ["JOS", "Joshua"], ["JDG", "Judges"], ["RUT", "Ruth"], ["1SA", "1 Samuel"], ["2SA", "2 Samuel"],
  ["1KI", "1 Kings"], ["2KI", "2 Kings"], ["1CH", "1 Chronicles"], ["2CH", "2 Chronicles"], ["EZR", "Ezra"],
  ["NEH", "Nehemiah"], ["EST", "Esther"], ["JOB", "Job"], ["PSA", "Psalms"], ["PRO", "Proverbs"],
  ["ECC", "Ecclesiastes"], ["SNG", "Song of Solomon"], ["ISA", "Isaiah"], ["JER", "Jeremiah"], ["LAM", "Lamentations"],
  ["EZK", "Ezekiel"], ["DAN", "Daniel"], ["HOS", "Hosea"], ["JOL", "Joel"], ["AMO", "Amos"],
  ["OBA", "Obadiah"], ["JON", "Jonah"], ["MIC", "Micah"], ["NAM", "Nahum"], ["HAB", "Habakkuk"],
  ["ZEP", "Zephaniah"], ["HAG", "Haggai"], ["ZEC", "Zechariah"], ["MAL", "Malachi"],
  ["MAT", "Matthew"], ["MRK", "Mark"], ["LUK", "Luke"], ["JHN", "John"], ["ACT", "Acts"],
  ["ROM", "Romans"], ["1CO", "1 Corinthians"], ["2CO", "2 Corinthians"], ["GAL", "Galatians"], ["EPH", "Ephesians"],
  ["PHP", "Philippians"], ["COL", "Colossians"], ["1TH", "1 Thessalonians"], ["2TH", "2 Thessalonians"], ["1TI", "1 Timothy"],
  ["2TI", "2 Timothy"], ["TIT", "Titus"], ["PHM", "Philemon"], ["HEB", "Hebrews"], ["JAS", "James"],
  ["1PE", "1 Peter"], ["2PE", "2 Peter"], ["1JN", "1 John"], ["2JN", "2 John"], ["3JN", "3 John"],
  ["JUD", "Jude"], ["REV", "Revelation"],
].map(([code, name], i) => ({ code, name, testament: i < 39 ? "OT" : "NT" as const })) as CanonBook[];

type VersionDef = {
  id: string; // ids yor/hau/ibo must match settings.bibleLangs keys
  label: string;
  language: string;
  lang: string;
  source: { kind: "getbible"; slug: string } | { kind: "helloao"; slug: string };
};

const VERSIONS: VersionDef[] = [
  { id: "kjv", label: "KJV", language: "English", lang: "en", source: { kind: "getbible", slug: "kjv" } },
  { id: "web", label: "WEB", language: "English", lang: "en", source: { kind: "getbible", slug: "web" } },
  { id: "asv", label: "ASV", language: "English", lang: "en", source: { kind: "getbible", slug: "asv" } },
  { id: "bbe", label: "BBE", language: "English", lang: "en", source: { kind: "getbible", slug: "basicenglish" } },
  { id: "yor", label: "Yoruba", language: "Yorùbá", lang: "yor", source: { kind: "helloao", slug: "yor_bib" } },
  { id: "hau", label: "Hausa", language: "Hausa", lang: "hau", source: { kind: "helloao", slug: "hau_bib" } },
  { id: "ibo", label: "Igbo", language: "Igbo", lang: "ibo", source: { kind: "helloao", slug: "ibo_bib" } },
];

type BookData = { c: Record<string, string[]> };

async function fetchJson<T>(url: string, tries = 7): Promise<T> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      const text = await r.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error(`bad JSON from ${url}: ${text.slice(0, 120)}`);
      }
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
    }
  }
  throw new Error("unreachable");
}

/** Run tasks with bounded concurrency. */
async function pool<T>(items: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const out: T[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await items[i]();
    }
  });
  await Promise.all(workers);
  return out;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/* ---------------- getbible (whole book per request) ---------------- */

type GetBibleBook = { chapters: { chapter: number; verses: { verse: number; text: string }[] }[] };

async function fetchGetBibleBook(slug: string, nr: number): Promise<BookData> {
  const d = await fetchJson<GetBibleBook>(`https://api.getbible.net/v2/${slug}/${nr}.json`);
  const c: Record<string, string[]> = {};
  for (const ch of d.chapters) {
    const verses: string[] = [];
    for (const v of ch.verses) verses[v.verse - 1] = clean(v.text);
    // fill holes from merged/absent verses so index = verse - 1 stays true
    for (let i = 0; i < verses.length; i++) verses[i] = verses[i] ?? "";
    c[String(ch.chapter)] = verses;
  }
  return { c };
}

/* ---------------- helloao (one chapter per request) ---------------- */

type HelloaoBooks = { books: { id: string; numberOfChapters: number }[] };
type HelloaoChapterItem =
  | { type: "verse"; number: number; content: (string | { text?: string; lineBreak?: boolean; noteId?: number })[] }
  | { type: string };

async function fetchHelloaoBook(slug: string, code: string, chapters: number): Promise<BookData> {
  const jobs = Array.from({ length: chapters }, (_, i) => async () => {
    let d: { chapter: { content: HelloaoChapterItem[] } };
    try {
      d = await fetchJson(`https://bible.helloao.org/api/${slug}/${code}/${i + 1}.json`);
    } catch (e) {
      // helloao serves its SPA HTML (200) for chapters that don't exist —
      // some book metadata over-counts (e.g. hau_bib DAN says 13). Skip those.
      if ((e as Error).message.includes("<!doctype")) return null;
      throw e;
    }
    const verses: string[] = [];
    for (const item of d.chapter.content) {
      if (item.type !== "verse") continue;
      const v = item as Extract<HelloaoChapterItem, { type: "verse" }>;
      const text = v.content
        .map((p) => (typeof p === "string" ? p : p.text ?? (p.lineBreak ? " " : "")))
        .join(" ");
      verses[v.number - 1] = clean(text);
    }
    for (let j = 0; j < verses.length; j++) verses[j] = verses[j] ?? "";
    return [String(i + 1), verses] as const;
  });
  const entries = await pool(jobs, 4);
  return { c: Object.fromEntries(entries.filter((e) => e !== null)) };
}

/* ---------------- main ---------------- */

async function main() {
  const manifestVersions = [];

  for (const v of VERSIONS) {
    const dir = path.join(OUT, v.id);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    const chapterCounts: Record<string, number> = {};
    const books: string[] = [];

    let helloaoBooks: HelloaoBooks["books"] | null = null;
    if (v.source.kind === "helloao") {
      helloaoBooks = (await fetchJson<HelloaoBooks>(`https://bible.helloao.org/api/${v.source.slug}/books.json`)).books;
    }

    const failed: string[] = [];
    const bookJobs = CANON.map((book, idx) => async () => {
      const file = path.join(dir, `${book.code}.json`);
      try {
        let data: BookData;
        if (existsSync(file)) {
          data = JSON.parse(await Bun.file(file).text()) as BookData;
        } else if (v.source.kind === "getbible") {
          data = await fetchGetBibleBook(v.source.slug, idx + 1);
          await Bun.write(file, JSON.stringify(data));
        } else {
          const meta = helloaoBooks!.find((b) => b.id === book.code);
          if (!meta) return null; // book absent in this translation
          data = await fetchHelloaoBook(v.source.slug, book.code, meta.numberOfChapters);
          await Bun.write(file, JSON.stringify(data));
        }
        return { code: book.code, chapters: Object.keys(data.c).length };
      } catch (e) {
        failed.push(book.code);
        console.error(`  ✖ ${v.id}/${book.code}: ${(e as Error).message}`);
        return null;
      }
    });

    // Whole-book requests are heavy on getbible; keep book-level concurrency low
    // (helloao chapter fetches already fan out inside each book).
    const results = await pool(bookJobs, v.source.kind === "getbible" ? 6 : 2);
    for (const r of results) {
      if (!r) continue;
      books.push(r.code);
      chapterCounts[r.code] = r.chapters;
    }
    // keep canonical order
    books.sort((a, b) => CANON.findIndex((x) => x.code === a) - CANON.findIndex((x) => x.code === b));

    manifestVersions.push({ id: v.id, label: v.label, language: v.language, lang: v.lang, books, chapterCounts });
    console.log(`✔ ${v.id}: ${books.length} books${failed.length ? ` (${failed.length} FAILED — re-run to resume)` : ""}`);
    if (failed.length) process.exitCode = 1;
  }

  await Bun.write(
    path.join(OUT, "manifest.json"),
    JSON.stringify({ canon: CANON, versions: manifestVersions }),
  );
  console.log(`✔ manifest.json written to ${OUT}`);
}

await main();
