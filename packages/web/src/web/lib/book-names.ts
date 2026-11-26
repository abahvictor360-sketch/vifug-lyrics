/**
 * The ways people actually type a book of the Bible.
 *
 * parseReference matches what was typed against the canon's names, which
 * covers full names and anything that starts the same way ("1 cor", "gen").
 * It does not cover the standard abbreviations that are not a start of the
 * name ("1kgs", "jn", "mk") or a Roman numeral in front of the number ("II
 * Kings", "iii john"). This does.
 *
 * Only abbreviations that point at one book are listed. "jo" and "ph" could
 * be several, so they are left to the existing matching rather than guessed.
 */

/** "I", "II", "III", "1st", "First" ... at the front of a book name, as a digit. */
const NUMERALS: [RegExp, string][] = [
  [/^(?:iii|3rd|third)[\s.]*(?=[a-z])/, "3 "],
  [/^(?:ii|2nd|second)[\s.]*(?=[a-z])/, "2 "],
  // A bare "i" must be followed by a space or dot: "isaiah" is not "I saiah".
  [/^(?:1st|first)[\s.]*(?=[a-z])/, "1 "],
  [/^i[\s.]+(?=[a-z])/, "1 "],
];

/** Lower-case the text and turn a leading Roman or spelled-out number into a digit. */
export function normaliseBookText(raw: string): string {
  let s = raw.trim().toLowerCase().replace(/\s+/g, " ");
  // "ii." / "iii." need the dot handled before the numeral rules.
  for (const [re, digit] of NUMERALS) {
    if (re.test(s)) {
      s = s.replace(re, digit);
      break;
    }
  }
  return s.replace(/\s+/g, " ").trim();
}

/** Compact form used as the table key: no spaces or dots. */
const compact = (s: string) => s.replace(/[\s.]+/g, "");

const TABLE: Record<string, string[]> = {
  Genesis: ["gen", "ge", "gn"],
  Exodus: ["ex", "exo", "exod"],
  Leviticus: ["lev", "le", "lv"],
  Numbers: ["num", "nu", "nm", "nb"],
  Deuteronomy: ["deut", "dt"],
  Joshua: ["josh", "jos", "jsh"],
  Judges: ["judg", "jdg", "jg", "jdgs"],
  Ruth: ["ru", "rth"],
  Nehemiah: ["neh", "ne"],
  Esther: ["est", "esth"],
  Job: ["jb"],
  Psalms: ["ps", "psa", "psalm", "pslm", "psm", "pss"],
  Proverbs: ["prov", "pro", "prv", "pr"],
  Ecclesiastes: ["eccl", "eccles", "ecc", "ec", "qoh"],
  "Song of Solomon": ["song", "sos", "ss", "sng", "songofsongs", "canticles"],
  Isaiah: ["isa", "is"],
  Jeremiah: ["jer", "je", "jr"],
  Lamentations: ["lam", "la"],
  Ezekiel: ["ezek", "eze", "ezk"],
  Daniel: ["dan", "dn", "da"],
  Hosea: ["hos", "ho"],
  Joel: ["jl"],
  Amos: ["am", "amo"],
  Obadiah: ["ob", "oba", "obad"],
  Jonah: ["jnh"],
  Micah: ["mic", "mc"],
  Nahum: ["nah", "na", "nam"],
  Habakkuk: ["hab", "hb"],
  Zephaniah: ["zeph", "zep", "zp"],
  Haggai: ["hag", "hg"],
  Zechariah: ["zech", "zec", "zc"],
  Malachi: ["mal", "ml"],
  Matthew: ["matt", "mt", "mat"],
  Mark: ["mk", "mrk", "mar"],
  Luke: ["lk", "luk"],
  John: ["jn", "jhn", "joh"],
  Acts: ["ac", "act"],
  Romans: ["rom", "ro", "rm"],
  Galatians: ["gal", "ga"],
  Ephesians: ["eph", "ep", "ephes"],
  Philippians: ["php", "pp"],
  Colossians: ["col", "cl"],
  Titus: ["tit"],
  Philemon: ["phlm", "phm", "philem"],
  Hebrews: ["heb"],
  James: ["jas", "jm", "jam"],
  Jude: ["jud", "jd"],
  Revelation: ["rev", "rv", "revelations", "apocalypse"],
};

/** Numbered books: the short forms of the book, tried after the number. */
const NUMBERED: Record<string, { name: string; forms: string[]; counts: number[] }> = {
  Samuel: { name: "Samuel", forms: ["sa", "sam", "sm"], counts: [1, 2] },
  Kings: { name: "Kings", forms: ["ki", "kg", "kgs", "king", "kin"], counts: [1, 2] },
  Chronicles: { name: "Chronicles", forms: ["ch", "chr", "chron", "chro"], counts: [1, 2] },
  Corinthians: { name: "Corinthians", forms: ["co", "cor", "corin"], counts: [1, 2] },
  Thessalonians: { name: "Thessalonians", forms: ["th", "thes", "thess"], counts: [1, 2] },
  Timothy: { name: "Timothy", forms: ["ti", "tim"], counts: [1, 2] },
  Peter: { name: "Peter", forms: ["pe", "pet", "pt", "ptr"], counts: [1, 2] },
  John: { name: "John", forms: ["jn", "jhn", "jo", "joh"], counts: [1, 2, 3] },
};

const ALIASES: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [name, forms] of Object.entries(TABLE)) for (const f of forms) m.set(f, name);
  for (const b of Object.values(NUMBERED)) {
    for (const n of b.counts) for (const f of b.forms) m.set(`${n}${f}`, `${n} ${b.name}`);
  }
  return m;
})();

/**
 * The canon name a typed book stands for, or null. `raw` is what was typed,
 * before or after normaliseBookText.
 */
export function bookNameForAlias(raw: string): string | null {
  return ALIASES.get(compact(normaliseBookText(raw))) ?? null;
}
