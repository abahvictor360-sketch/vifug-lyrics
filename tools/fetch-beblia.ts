/**
 * Import English Bible translations from the Beblia XML collection
 * (https://github.com/Beblia/Holy-Bible-XML-Format) into the app's offline
 * format under packages/web/public/bible/.
 *
 * XML shape:
 *   <bible translation="..."><testament><book number="1">
 *     <chapter number="1"><verse number="1">text</verse>...
 * Book numbers follow the 66-book Protestant canon order (same as CANON here).
 *
 * KJV and ASV are skipped — the app already bundles them from getbible.
 * Existing versions in manifest.json are preserved; English versions are
 * re-ordered most-used-first, non-English packs stay at the end.
 *
 * Run: bun tools/fetch-beblia.ts   (re-runs skip already-downloaded versions)
 */

import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dir, "../packages/web/public/bible");
const RAW = "https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master";

// Same 66-book canon as fetch-bible.ts; Beblia book number = index + 1.
const CANON_CODES = [
  "GEN","EXO","LEV","NUM","DEU","JOS","JDG","RUT","1SA","2SA",
  "1KI","2KI","1CH","2CH","EZR","NEH","EST","JOB","PSA","PRO",
  "ECC","SNG","ISA","JER","LAM","EZK","DAN","HOS","JOL","AMO",
  "OBA","JON","MIC","NAM","HAB","ZEP","HAG","ZEC","MAL",
  "MAT","MRK","LUK","JHN","ACT","ROM","1CO","2CO","GAL","EPH",
  "PHP","COL","1TH","2TH","1TI","2TI","TIT","PHM","HEB","JAS",
  "1PE","2PE","1JN","2JN","3JN","JUD","REV",
];

/** file (in Beblia repo) → app version id + display label. */
const BEBLIA_VERSIONS: { file: string; id: string; label: string }[] = [
  { file: "EnglishNIVBible.xml", id: "niv", label: "NIV" },
  { file: "EnglishNKJBible.xml", id: "nkjv", label: "NKJV" },
  { file: "EnglishESVBible.xml", id: "esv", label: "ESV" },
  { file: "EnglishNLTBible.xml", id: "nlt", label: "NLT" },
  { file: "EnglishNASBBible.xml", id: "nasb", label: "NASB" },
  { file: "EnglishCSBBible.xml", id: "csb", label: "CSB" },
  { file: "EnglishAmplifiedBible.xml", id: "amp", label: "Amplified (AMP)" },
  { file: "EnglishAmplifiedClassicBible.xml", id: "ampc", label: "Amplified Classic (AMPC)" },
  { file: "EnglishBereanBible.xml", id: "bsb", label: "Berean (BSB)" },
  { file: "EnglishDarbyBible.xml", id: "darby", label: "Darby" },
  { file: "EnglishEASYBible.xml", id: "easy", label: "EasyEnglish (EASY)" },
  { file: "EnglishERVBible.xml", id: "erv", label: "ERV" },
  { file: "EnglishGNTBible.xml", id: "gnt", label: "Good News (GNT)" },
  { file: "EnglishGWBible.xml", id: "gw", label: "God's Word (GW)" },
  { file: "EnglishHCSBBible.xml", id: "hcsb", label: "HCSB" },
  { file: "EnglishLSBBible.xml", id: "lsb", label: "LSB" },
  { file: "EnglishMEVBible.xml", id: "mev", label: "MEV" },
  { file: "EnglishNASUBible.xml", id: "nasu", label: "NASB 1995 (NASU)" },
  { file: "EnglishNETBible.xml", id: "net", label: "NET" },
  { file: "EnglishNIRVBible.xml", id: "nirv", label: "NIrV" },
  { file: "EnglishNRSVBible.xml", id: "nrsv", label: "NRSV" },
  { file: "EnglishPassionBible.xml", id: "tpt", label: "Passion (TPT)" },
  { file: "EnglishRSVBible.xml", id: "rsv", label: "RSV" },
  { file: "EnglishTLBible.xml", id: "tlb", label: "Living Bible (TLB)" },
  { file: "EnglishTyndale1537Bible.xml", id: "tyn", label: "Tyndale 1537" },
  { file: "EnglishYLTBible.xml", id: "ylt", label: "YLT" },
];

/** Manifest order: most-used English first, then the rest, then other languages. */
const ENGLISH_ORDER = [
  "kjv", "niv", "nkjv", "esv", "nlt", "nasb", "csb", "amp", "ampc", "bsb",
  "csb", "darby", "easy", "erv", "gnt", "gw", "hcsb", "lsb", "mev", "nasu",
  "net", "nirv", "nrsv", "tpt", "rsv", "tlb", "tyn", "ylt", "web", "asv", "bbe",
];

const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

type BookData = { c: Record<string, string[]> };

async function fetchXml(file: string, tries = 5): Promise<string> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${RAW}/${file}`);
      if (!r.ok) throw new Error(`${r.status} ${file}`);
      return await r.text();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
    }
  }
  throw new Error("unreachable");
}

function parseBible(xml: string): Map<number, BookData> {
  const books = new Map<number, BookData>();
  const bookRe = /<book number="(\d+)"[^>]*>([\s\S]*?)<\/book>/g;
  const chapterRe = /<chapter number="(\d+)"[^>]*>([\s\S]*?)<\/chapter>/g;
  const verseRe = /<verse number="(\d+)"[^>]*>([\s\S]*?)<\/verse>/g;
  for (const b of xml.matchAll(bookRe)) {
    const nr = Number(b[1]);
    const c: Record<string, string[]> = {};
    for (const ch of b[2].matchAll(chapterRe)) {
      const verses: string[] = [];
      for (const v of ch[2].matchAll(verseRe)) {
        // strip any nested tags (footnotes etc.) before entity-decoding
        verses[Number(v[1]) - 1] = decode(v[2].replace(/<[^>]+>/g, " "));
      }
      for (let i = 0; i < verses.length; i++) verses[i] = verses[i] ?? "";
      c[ch[1]] = verses;
    }
    books.set(nr, { c });
  }
  return books;
}

async function main() {
  const manifestPath = path.join(OUT, "manifest.json");
  const manifest = JSON.parse(await Bun.file(manifestPath).text()) as {
    canon: { code: string }[];
    versions: { id: string; label: string; language: string; lang: string; books: string[]; chapterCounts: Record<string, number> }[];
  };

  for (const v of BEBLIA_VERSIONS) {
    const dir = path.join(OUT, v.id);
    const already = manifest.versions.find((m) => m.id === v.id);
    if (already && existsSync(dir)) {
      console.log(`• ${v.id}: already imported, skipping`);
      continue;
    }
    process.stdout.write(`↓ ${v.id} (${v.file})… `);
    const xml = await fetchXml(v.file);
    const books = parseBible(xml);
    if (!books.size) throw new Error(`${v.file}: parsed 0 books`);
    await mkdir(dir, { recursive: true });
    const bookCodes: string[] = [];
    const chapterCounts: Record<string, number> = {};
    for (const [nr, data] of books) {
      const code = CANON_CODES[nr - 1];
      if (!code) continue; // apocrypha etc. — outside the 66-book canon
      await Bun.write(path.join(dir, `${code}.json`), JSON.stringify(data));
      bookCodes.push(code);
      chapterCounts[code] = Object.keys(data.c).length;
    }
    bookCodes.sort((a, b) => CANON_CODES.indexOf(a) - CANON_CODES.indexOf(b));
    const entry = { id: v.id, label: v.label, language: "English", lang: "en", books: bookCodes, chapterCounts };
    const idx = manifest.versions.findIndex((m) => m.id === v.id);
    if (idx >= 0) manifest.versions[idx] = entry;
    else manifest.versions.push(entry);
    console.log(`${bookCodes.length} books`);
  }

  // Order: English by ENGLISH_ORDER, anything unlisted after, other languages last.
  const rank = (m: { id: string; lang: string }) => {
    if (m.lang !== "en") return 10_000 + manifest.versions.findIndex((x) => x.id === m.id);
    const i = ENGLISH_ORDER.indexOf(m.id);
    return i === -1 ? 5_000 : i;
  };
  manifest.versions.sort((a, b) => rank(a) - rank(b));

  await Bun.write(manifestPath, JSON.stringify(manifest));
  console.log(`✔ manifest.json now lists ${manifest.versions.length} versions`);
}

await main();
