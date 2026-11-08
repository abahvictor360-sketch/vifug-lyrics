/**
 * Run with: bun test src/web/lib/easyworship.test.ts
 *
 * The databases here are built to the layout OpenLP's importer documents
 * (Songs.db `song`, SongWords.db `word`), not copied from a real library -
 * so these prove the reader does what it says to that layout, and a real
 * EasyWorship library is still the final check.
 */
import { expect, test } from "bun:test";
import initSqlJs from "sql.js";
import { readEasyWorshipLibrary, rtfToText, splitAuthors, wordsToText } from "./easyworship";

const rtf = (...slides: string[]) =>
  "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}{\\colortbl;\\red0\\green0\\blue0;}\\pard " +
  slides.map((s) => s.split("\n").join("\\par ")).join("\\par\\par ") +
  "}";

async function build() {
  const SQL = await initSqlJs();
  const songs = new SQL.Database();
  songs.run("CREATE TABLE song (title TEXT, author TEXT, copyright TEXT, vendor_id INTEGER)");
  songs.run("INSERT INTO song VALUES (?,?,?,?)", ["Amazing Grace", "John Newton / Chris Tomlin", "Public Domain", 1]);
  songs.run("INSERT INTO song VALUES (?,?,?,?)", ["Empty Song", "", "", 2]);
  songs.run("INSERT INTO song VALUES (?,?,?,?)", ["Cliché", "A. Writer", "", 3]);
  const words = new SQL.Database();
  words.run("CREATE TABLE word (song_id INTEGER, words BLOB)");
  words.run("INSERT INTO word VALUES (?,?)", [
    1,
    new TextEncoder().encode(
      rtf("Verse 1\nAmazing grace how sweet the sound\nThat saved a wretch like me", "Chorus\nMy chains are gone"),
    ),
  ]);
  // Song 2 has no words row at all. Song 3 is Windows-1252: \'e9 is an e-acute
  // and the blob itself contains a raw 0xE9 byte, which is not valid UTF-8.
  const raw = "{\\rtf1\\ansi Verse 1\\par Cliché caf\\'e9 na\\u239?ve}";
  const bytes = Uint8Array.from(raw, (c) => (c.charCodeAt(0) > 255 ? 63 : c.charCodeAt(0)));
  words.run("INSERT INTO word VALUES (?,?)", [3, bytes]);
  return { SQL, songs: songs.export(), words: words.export() };
}

test("reads titles, authors, copyright and words, in section form", async () => {
  const { SQL, songs, words } = await build();
  const lib = readEasyWorshipLibrary(SQL, songs, words);
  expect(lib.songs.map((s) => s.title)).toEqual(["Amazing Grace", "Cliché"]);
  expect(lib.skipped).toBe(1); // the song with no words
  const grace = lib.songs[0];
  expect(grace.authors).toEqual(["John Newton", "Chris Tomlin"]);
  expect(grace.copyright).toBe("Public Domain");
  expect(grace.text).toBe(
    "Verse 1\nAmazing grace how sweet the sound\nThat saved a wretch like me\n\nChorus\nMy chains are gone",
  );
});

test("decodes Windows-1252 bytes and \\u escapes", async () => {
  const { SQL, songs, words } = await build();
  const lib = readEasyWorshipLibrary(SQL, songs, words);
  expect(lib.songs[1].text).toBe("Verse 1\nCliché café naïve");
});

test("rtfToText skips font and colour tables and unescapes braces", () => {
  expect(rtfToText("{\\rtf1{\\fonttbl{\\f0 Arial;}}{\\*\\generator x;}a \\{b\\} c\\par d}")).toBe("a {b} c\nd");
});

test("plain text words pass through", () => {
  expect(wordsToText(new TextEncoder().encode("Verse 1\r\nline"))).toBe("Verse 1\nline");
});

test("authors split on the first separator that finds more than one", () => {
  expect(splitAuthors("A; B")).toEqual(["A", "B"]);
  expect(splitAuthors("A, B")).toEqual(["A", "B"]);
  expect(splitAuthors("Solo")).toEqual(["Solo"]);
  expect(splitAuthors("")).toEqual([]);
});

test("wrong files give a readable error", async () => {
  const SQL = await initSqlJs();
  const empty = new SQL.Database().export();
  expect(() => readEasyWorshipLibrary(SQL, empty, empty)).toThrow(/word/);
});
