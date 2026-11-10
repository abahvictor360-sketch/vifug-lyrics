/**
 * Read a Bible translation out of whatever file someone has.
 *
 * Formats are the ones translations actually travel in:
 *  - plain text or CSV/TSV, one verse a line:  "John 3:16 For God so loved..."
 *  - JSON: an array of {book, chapter, verse, text}, or Vifug's own
 *    {GEN: {c: {"1": ["verse", ...]}}} shape
 *  - OSIS, USFX and Zefania XML
 *
 * The result is the shape /bible/<version>/<CODE>.json already uses, so a
 * translation added here is indistinguishable from a built-in one downstream.
 */
import type { CanonBook } from "../hooks/use-bible";

export type ParsedBible = {
  /** book code -> { c: { "1": ["verse 1", "verse 2", ...] } } */
  books: Record<string, { c: Record<string, string[]> }>;
  verseCount: number;
  /** Things worth telling the person: unreadable lines, missing books. */
  warnings: string[];
};

/** OSIS book ids, in canon order, to line up with the 66 canon codes. */
const OSIS = [
  "Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth", "1Sam", "2Sam", "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra",
  "Neh", "Esth", "Job", "Ps", "Prov", "Eccl", "Song", "Isa", "Jer", "Lam", "Ezek", "Dan", "Hos", "Joel", "Amos", "Obad",
  "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal", "Matt", "Mark", "Luke", "John", "Acts", "Rom", "1Cor",
  "2Cor", "Gal", "Eph", "Phil", "Col", "1Thess", "2Thess", "1Tim", "2Tim", "Titus", "Phlm", "Heb", "Jas", "1Pet", "2Pet",
  "1John", "2John", "3John", "Jude", "Rev",
];

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Extra spellings seen in the wild, mapped to the OSIS id. */
const EXTRA: Record<string, string> = {
  psalm: "Ps", psalms: "Ps", songofsolomon: "Song", songofsongs: "Song", canticles: "Song", revelationofjohn: "Rev",
  revelations: "Rev", sos: "Song", ss: "Song", phm: "Phlm", philem: "Phlm", jam: "Jas", james: "Jas", jhn: "John",
  mrk: "Mark", mk: "Mark", jn: "John", lk: "Luke", mt: "Matt", ac: "Acts", php: "Phil", pss: "Ps", psa: "Ps",
  ezk: "Ezek", jol: "Joel", amo: "Amos", oba: "Obad", jon: "Jonah", nam: "Nah", zep: "Zeph", zec: "Zech",
  eze: "Ezek", mar: "Mark", joh: "John",
};

export type BookResolver = (raw: string | number) => string | null;

export function makeBookResolver(canon: CanonBook[]): BookResolver {
  const map = new Map<string, string>();
  canon.forEach((b, i) => {
    map.set(key(b.name), b.code);
    map.set(key(b.code), b.code);
    const osis = OSIS[i];
    if (osis) map.set(key(osis), b.code);
    // "1 John", "I John", "First John".
    const m = /^([123])\s+(.+)$/.exec(b.name);
    if (m) {
      const roman = { "1": "i", "2": "ii", "3": "iii" }[m[1] as "1" | "2" | "3"];
      const word = { "1": "first", "2": "second", "3": "third" }[m[1] as "1" | "2" | "3"];
      map.set(key(`${roman}${m[2]}`), b.code);
      map.set(key(`${word}${m[2]}`), b.code);
    }
  });
  for (const [alias, osis] of Object.entries(EXTRA)) {
    const i = OSIS.indexOf(osis);
    if (i >= 0 && canon[i]) map.set(alias, canon[i]!.code);
  }
  return (raw) => {
    if (typeof raw === "number") return canon[raw - 1]?.code ?? null;
    const t = raw.trim();
    if (/^\d{1,2}$/.test(t)) return canon[Number(t) - 1]?.code ?? null;
    return map.get(key(t)) ?? null;
  };
}

function emptyResult(): ParsedBible {
  return { books: {}, verseCount: 0, warnings: [] };
}

function put(res: ParsedBible, code: string, chapter: number, verse: number, text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || chapter < 1 || verse < 1 || chapter > 200 || verse > 200) return;
  const book = (res.books[code] ??= { c: {} });
  const ch = (book.c[String(chapter)] ??= []);
  // Verses may arrive out of order or with gaps; keep the position = verse - 1.
  while (ch.length < verse - 1) ch.push("");
  if (!ch[verse - 1]) res.verseCount++;
  ch[verse - 1] = t;
}

function finish(res: ParsedBible, canon: CanonBook[]): ParsedBible {
  // A chapter's trailing blanks are noise; interior gaps stay (verse numbering).
  for (const b of Object.values(res.books)) {
    for (const [k, v] of Object.entries(b.c)) {
      while (v.length && !v[v.length - 1]) v.pop();
      if (!v.length) delete b.c[k];
    }
  }
  const missing = canon.filter((b) => !res.books[b.code]).map((b) => b.name);
  if (missing.length && missing.length < 66) {
    res.warnings.push(
      missing.length > 8
        ? `${missing.length} books are not in this file (for example ${missing.slice(0, 4).join(", ")}). Only the books present will be available.`
        : `Not in this file: ${missing.join(", ")}.`,
    );
  }
  return res;
}

/* ---- text / CSV ---- */

function parseLines(text: string, resolve: BookResolver, res: ParsedBible) {
  // "John 3:16 text", "1 John 2:3<TAB>text", "John,3,16,"text"", "Gen 1:1|text".
  const ref = /^\s*"?((?:[1-3]|I{1,3})?\s*[A-Za-z][A-Za-z .]*?)\.?"?\s*(?:,|\t|\s)\s*"?(\d{1,3})"?\s*(?:[:.,]|\t|\s)\s*"?(\d{1,3})"?\s*(?:[|,\t\-–:]|\s)\s*(.+?)\s*"?\s*$/;
  let bad = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = ref.exec(line);
    const code = m ? resolve(m[1]!) : null;
    if (!m || !code) {
      bad++;
      continue;
    }
    put(res, code, Number(m[2]), Number(m[3]), m[4]!.replace(/^"(.*)"?$/, "$1").replace(/""/g, '"'));
  }
  if (bad) res.warnings.push(`${bad} line${bad === 1 ? "" : "s"} could not be read as "Book chapter:verse text" and were skipped.`);
}

/* ---- JSON ---- */

type Row = Record<string, unknown>;

function parseJson(text: string, resolve: BookResolver, res: ParsedBible) {
  const data: unknown = JSON.parse(text);
  const rows: Row[] | null = Array.isArray(data)
    ? (data as Row[])
    : data && typeof data === "object" && Array.isArray((data as Row).verses)
      ? ((data as Row).verses as Row[])
      : null;
  if (rows) {
    for (const r of rows) {
      const bookRaw = (r.book ?? r.book_name ?? r.bookName ?? r.b ?? r.Book) as string | number | undefined;
      const code = bookRaw === undefined ? null : resolve(bookRaw);
      if (!code) continue;
      put(res, code, Number(r.chapter ?? r.c ?? r.Chapter), Number(r.verse ?? r.v ?? r.Verse), String(r.text ?? r.t ?? r.Text ?? ""));
    }
    return;
  }
  // Vifug / nested shapes: { GEN: { c: {...} } } or { books: {...} } or { Genesis: { "1": { "1": "text" } } }.
  const root = (data as Row).books && typeof (data as Row).books === "object" ? ((data as Row).books as Row) : (data as Row);
  for (const [name, val] of Object.entries(root)) {
    const code = resolve(name);
    if (!code || !val || typeof val !== "object") continue;
    const chapters = ((val as Row).c ?? val) as Row;
    for (const [ch, verses] of Object.entries(chapters)) {
      if (Array.isArray(verses)) verses.forEach((t, i) => put(res, code, Number(ch), i + 1, String(t ?? "")));
      else if (verses && typeof verses === "object")
        for (const [vn, t] of Object.entries(verses as Row)) put(res, code, Number(ch), Number(vn), String(t ?? ""));
    }
  }
}

/* ---- XML (OSIS, USFX, Zefania) ---- */

const strip = (s: string) =>
  s
    .replace(/<note[\s\S]*?<\/note>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'");

function parseXml(text: string, resolve: BookResolver, res: ParsedBible) {
  // OSIS: <verse osisID="Gen.1.1">text</verse>   (also sID/eID milestones)
  let any = false;
  for (const m of text.matchAll(/<verse\b[^>]*?osisID="([^"]+)"[^>]*?>([\s\S]*?)<\/verse>/gi)) {
    const [bk, ch, vs] = m[1]!.split(".");
    const code = bk ? resolve(bk) : null;
    if (code && ch && vs) {
      put(res, code, Number(ch), Number(vs), strip(m[2]!));
      any = true;
    }
  }
  if (any) return;
  // Zefania: <BIBLEBOOK bnumber="1"><CHAPTER cnumber="1"><VERS vnumber="1">text</VERS>
  for (const b of text.matchAll(/<BIBLEBOOK\b([^>]*)>([\s\S]*?)<\/BIBLEBOOK>/gi)) {
    const num = /bnumber="(\d+)"/i.exec(b[1]!)?.[1];
    const name = /bname="([^"]+)"/i.exec(b[1]!)?.[1];
    const code = (num ? resolve(Number(num)) : null) ?? (name ? resolve(name) : null);
    if (!code) continue;
    for (const c of b[2]!.matchAll(/<CHAPTER\b[^>]*cnumber="(\d+)"[^>]*>([\s\S]*?)<\/CHAPTER>/gi)) {
      for (const v of c[2]!.matchAll(/<VERS\b[^>]*vnumber="(\d+)"[^>]*>([\s\S]*?)<\/VERS>/gi)) {
        put(res, code, Number(c[1]), Number(v[1]), strip(v[2]!));
        any = true;
      }
    }
  }
  if (any) return;
  // USFX: <book id="GEN"><c id="1"/><v id="1"/>text<ve/>
  for (const b of text.matchAll(/<book\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/book>/gi)) {
    const code = resolve(b[1]!);
    if (!code) continue;
    let chapter = 0;
    for (const t of b[2]!.matchAll(/<c\b[^>]*\bid="(\d+)"[^>]*\/?>|<v\b[^>]*\bid="(\d+)"[^>]*\/?>([\s\S]*?)(?=<v\b|<c\b|<\/book>|$)/gi)) {
      if (t[1]) chapter = Number(t[1]);
      else if (t[2] && chapter) put(res, code, chapter, Number(t[2]), strip(t[3] ?? ""));
    }
  }
}

export function parseBibleFile(text: string, filename: string, canon: CanonBook[]): ParsedBible {
  const resolve = makeBookResolver(canon);
  const res = emptyResult();
  const body = text.replace(/^﻿/, "");
  const head = body.trimStart().slice(0, 1);
  try {
    if (head === "<") parseXml(body, resolve, res);
    else if (head === "{" || head === "[") parseJson(body, resolve, res);
    else parseLines(body, resolve, res);
  } catch (e) {
    res.warnings.push(`The file could not be read as ${/\.json$/i.test(filename) ? "JSON" : "a Bible"}: ${e instanceof Error ? e.message : "unknown error"}.`);
  }
  return finish(res, canon);
}
