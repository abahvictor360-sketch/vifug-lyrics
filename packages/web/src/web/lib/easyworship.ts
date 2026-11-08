/**
 * EasyWorship 6 / 7 song library -> plain song text.
 *
 * The library is two SQLite files in EasyWorship's `Databases/Data` folder:
 *
 *   Songs.db      table `song`  (title, author, copyright, ...; one row per song)
 *   SongWords.db  table `word`  (song_id -> song.rowid, words = RTF)
 *
 * The RTF holds every slide of the song; slides are separated by a blank line
 * and the first line of a slide is its name ("Verse 1", "Chorus"). That is
 * exactly how the Import dialog's pasted-text format already works, so a song
 * comes out as ordinary text and goes through the same section detection as
 * everything else the operator imports.
 *
 * Layout taken from OpenLP's EasyWorship importer; no schema is documented by
 * EasyWorship itself. Everything below is therefore tolerant: a song with no
 * words, or words that will not decode, is skipped and counted rather than
 * stopping the library.
 *
 * The SQLite engine is passed in (see sqljs-loader.ts) so this file stays
 * free of bundler specifics and can be tested without a browser.
 */
import type { SqlJsStatic } from "sql.js";

export type EwSong = { title: string; authors: string[]; copyright: string | null; text: string };
export type EwLibrary = { songs: EwSong[]; skipped: number };

/** RTF destinations whose contents are not text a person would read. */
const IGNORED_DESTINATIONS = new Set([
  "fonttbl", "colortbl", "stylesheet", "info", "pict", "object", "header", "footer",
  "expandedcolortbl", "listtable", "listoverridetable", "generator", "themedata",
  "datastore", "latentstyles", "rsidtbl", "fldinst",
]);

const cp1252 = new TextDecoder("windows-1252");

/** Strip RTF down to its text, keeping paragraph breaks as line breaks. */
export function rtfToText(rtf: string): string {
  const out: string[] = [];
  const stack: boolean[] = [];
  let skip = false;
  let i = 0;
  const n = rtf.length;

  while (i < n) {
    const ch = rtf[i];
    if (ch === "{") {
      stack.push(skip);
      i++;
    } else if (ch === "}") {
      skip = stack.pop() ?? false;
      i++;
    } else if (ch === "\\") {
      const next = rtf[i + 1];
      if (next === undefined) break;
      if (next === "\\" || next === "{" || next === "}") {
        if (!skip) out.push(next);
        i += 2;
      } else if (next === "'") {
        const hex = rtf.slice(i + 2, i + 4);
        if (!skip && /^[0-9a-fA-F]{2}$/.test(hex)) {
          out.push(cp1252.decode(Uint8Array.of(parseInt(hex, 16))));
        }
        i += 4;
      } else if (next === "*") {
        skip = true; // an "ignorable destination": {\*\something ...}
        i += 2;
      } else if (next === "~") {
        if (!skip) out.push(" ");
        i += 2;
      } else if (next === "_") {
        if (!skip) out.push("-");
        i += 2;
      } else if (next === "\n" || next === "\r") {
        if (!skip) out.push("\n");
        i += 2;
      } else if (/[a-zA-Z]/.test(next)) {
        let j = i + 1;
        while (j < n && /[a-zA-Z]/.test(rtf[j])) j++;
        const word = rtf.slice(i + 1, j);
        let numStr = "";
        if (rtf[j] === "-" || /[0-9]/.test(rtf[j] ?? "")) {
          const k = j;
          j++;
          while (j < n && /[0-9]/.test(rtf[j])) j++;
          numStr = rtf.slice(k, j);
        }
        if (rtf[j] === " ") j++; // the delimiter space belongs to the control word
        if (IGNORED_DESTINATIONS.has(word)) {
          skip = true;
        } else if (!skip) {
          if (word === "par" || word === "line" || word === "sect" || word === "page") out.push("\n");
          else if (word === "tab") out.push("\t");
          else if (word === "u" && numStr) {
            let code = Number(numStr);
            if (code < 0) code += 65536;
            out.push(String.fromCharCode(code));
            // The \uN is followed by one ASCII stand-in for readers that
            // cannot show it ("\u233?"). Skip it so it is not read as text.
            if (rtf[j] === "\\" && rtf[j + 1] === "'") j += 4;
            else if (j < n && rtf[j] !== "\\" && rtf[j] !== "{" && rtf[j] !== "}") j++;
          }
        }
        i = j;
      } else {
        i += 2;
      }
    } else if (ch === "\r" || ch === "\n") {
      i++; // raw line endings in RTF source are not text
    } else {
      if (!skip) out.push(ch);
      i++;
    }
  }

  return out
    .join("")
    .split("\n")
    .map((l) => l.replace(/\u0000/g, "").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A `words` cell as text: UTF-8 when it is, Windows-1252 when it is not. */
function decodeCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(value);
    } catch {
      return cp1252.decode(value);
    }
  }
  return String(value);
}

/** The words of one song as lines, whether stored as RTF or as plain text. */
export function wordsToText(value: unknown): string {
  const raw = decodeCell(value).trim();
  if (!raw) return "";
  return /^\{\\rtf/i.test(raw) ? rtfToText(raw) : raw.replace(/\r\n?/g, "\n");
}

/** "A / B", "A; B" and "A, B" all mean two people. */
export function splitAuthors(author: string | null | undefined): string[] {
  const a = (author ?? "").trim();
  if (!a) return [];
  for (const sep of ["/", ";", ","]) {
    const parts = a.split(sep).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }
  return [a];
}

const cleanText = (v: unknown): string => decodeCell(v).trim();

/**
 * Read a whole EasyWorship 6/7 library from its two database files.
 * Throws a readable Error when the files are not what they should be.
 */
export function readEasyWorshipLibrary(
  SQL: SqlJsStatic,
  songsDb: ArrayBuffer | Uint8Array,
  wordsDb: ArrayBuffer | Uint8Array,
): EwLibrary {
  const toBytes = (b: ArrayBuffer | Uint8Array) => (b instanceof Uint8Array ? b : new Uint8Array(b));

  let songs: InstanceType<SqlJsStatic["Database"]>;
  let words: InstanceType<SqlJsStatic["Database"]>;
  try {
    songs = new SQL.Database(toBytes(songsDb));
    words = new SQL.Database(toBytes(wordsDb));
  } catch {
    throw new Error("Those files could not be opened as EasyWorship databases.");
  }

  try {
    const wordsBySong = new Map<number, unknown>();
    try {
      const st = words.prepare("SELECT song_id, words FROM word");
      while (st.step()) {
        const [songId, w] = st.get();
        // First row wins, as EasyWorship itself reads it.
        if (!wordsBySong.has(Number(songId))) wordsBySong.set(Number(songId), w);
      }
      st.free();
    } catch {
      throw new Error("SongWords.db has no `word` table - is that the right file?");
    }

    const out: EwSong[] = [];
    let skipped = 0;
    try {
      const st = songs.prepare("SELECT rowid, title, author, copyright FROM song");
      while (st.step()) {
        const [rowid, title, author, copyright] = st.get();
        const text = wordsToText(wordsBySong.get(Number(rowid)));
        const name = cleanText(title);
        if (!name || !text) {
          skipped++;
          continue;
        }
        out.push({
          title: name,
          authors: splitAuthors(cleanText(author)),
          copyright: cleanText(copyright) || null,
          text,
        });
      }
      st.free();
    } catch {
      throw new Error("Songs.db has no `song` table - is that the right file?");
    }

    return { songs: out, skipped };
  } finally {
    songs.close();
    words.close();
  }
}
