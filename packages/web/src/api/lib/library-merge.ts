/**
 * Bring another Vifug library into this one, without replacing anything.
 *
 * Restore swaps the whole database, which is right for moving house and wrong
 * for everything else: a second campus with songs of its own, a volunteer who
 * typed in forty songs at home, two laptops that have drifted apart. This
 * adds what the other library has and this one lacks, and touches nothing
 * that is already here.
 *
 * What counts as "already here":
 *  - a row with the same id (the same item, imported before - so importing
 *    the same library twice adds nothing the second time);
 *  - a song or presentation with the same title, a theme with the same name,
 *    a media item pointing at the same file. Both installs ship the same 325
 *    songs under different ids, and nobody wants them twice.
 *
 * Songs keep their look: a song that used a theme or background which was
 * skipped as a duplicate is pointed at the copy that is already here.
 * Settings, service plans and live history are not imported - they describe
 * the other machine's services, not its library.
 */
import { createClient, type Client, type InValue } from "@libsql/client";
import { rawClient } from "../database";

export type MergeResult = {
  songs: { added: number; skipped: number };
  presentations: { added: number; skipped: number };
  media: { added: number; skipped: number };
  themes: { added: number; skipped: number };
  fonts: { added: number; skipped: number };
};

type Row = Record<string, InValue>;

async function columns(c: Client, table: string): Promise<string[]> {
  try {
    const info = await c.execute(`PRAGMA table_info(${table})`);
    return info.rows.map((r) => String((r as unknown as { name: string }).name));
  } catch {
    return [];
  }
}

async function all(c: Client, table: string): Promise<Row[]> {
  try {
    const res = await c.execute(`SELECT * FROM ${table}`);
    return res.rows.map((r) => ({ ...(r as unknown as Row) }));
  } catch {
    // A library from an older version may not have the table at all.
    return [];
  }
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

export async function mergeLibrary(srcFile: string): Promise<MergeResult> {
  const src = createClient({ url: "file:" + srcFile.replace(/\\/g, "/") });
  const dest = rawClient;
  const result: MergeResult = {
    songs: { added: 0, skipped: 0 },
    presentations: { added: 0, skipped: 0 },
    media: { added: 0, skipped: 0 },
    themes: { added: 0, skipped: 0 },
    fonts: { added: 0, skipped: 0 },
  };

  /** Insert rows into `table`, using only the columns both libraries have. */
  const insert = async (table: string, rows: Row[]) => {
    if (!rows.length) return;
    const shared = (await columns(dest, table)).filter((col) => col in rows[0]!);
    if (!shared.length) return;
    const sql = `INSERT OR IGNORE INTO ${table} (${shared.join(", ")}) VALUES (${shared.map(() => "?").join(", ")})`;
    for (let i = 0; i < rows.length; i += 200) {
      await dest.batch(
        rows.slice(i, i + 200).map((r) => ({ sql, args: shared.map((col) => r[col] ?? null) })),
        "write",
      );
    }
  };

  try {
    // ---- media: same file = same item ----
    const mediaMap = new Map<string, string>(); // source id -> id to use here
    {
      const here = await all(dest, "media");
      const byId = new Set(here.map((r) => String(r.id)));
      const byUri = new Map(here.map((r) => [String(r.uri), String(r.id)]));
      const add: Row[] = [];
      for (const r of await all(src, "media")) {
        const id = String(r.id);
        if (byId.has(id)) { mediaMap.set(id, id); result.media.skipped++; continue; }
        const same = byUri.get(String(r.uri));
        if (same) { mediaMap.set(id, same); result.media.skipped++; continue; }
        add.push(r); mediaMap.set(id, id); byUri.set(String(r.uri), id); result.media.added++;
      }
      await insert("media", add);
    }

    // ---- fonts: same name = same font ----
    {
      const here = await all(dest, "fonts");
      const ids = new Set(here.map((r) => String(r.id)));
      const names = new Set(here.map((r) => norm(r.name)));
      const add: Row[] = [];
      for (const r of await all(src, "fonts")) {
        if (ids.has(String(r.id)) || names.has(norm(r.name))) { result.fonts.skipped++; continue; }
        add.push(r); names.add(norm(r.name)); result.fonts.added++;
      }
      await insert("fonts", add);
    }

    // ---- themes: same name = same theme ----
    const themeMap = new Map<string, string>();
    {
      const here = await all(dest, "themes");
      const byId = new Set(here.map((r) => String(r.id)));
      const byName = new Map(here.map((r) => [norm(r.name), String(r.id)]));
      const add: Row[] = [];
      for (const r of await all(src, "themes")) {
        const id = String(r.id);
        if (byId.has(id)) { themeMap.set(id, id); result.themes.skipped++; continue; }
        const same = byName.get(norm(r.name));
        if (same) { themeMap.set(id, same); result.themes.skipped++; continue; }
        if (r.background_id) r.background_id = mediaMap.get(String(r.background_id)) ?? null;
        add.push(r); themeMap.set(id, id); byName.set(norm(r.name), id); result.themes.added++;
      }
      await insert("themes", add);
    }

    // ---- songs, with everything that hangs off them ----
    {
      const here = await all(dest, "songs");
      const ids = new Set(here.map((r) => String(r.id)));
      const titles = new Set(here.map((r) => norm(r.title)));
      const taken = new Set<string>();
      const add: Row[] = [];
      for (const r of await all(src, "songs")) {
        if (ids.has(String(r.id)) || titles.has(norm(r.title))) { result.songs.skipped++; continue; }
        if (r.theme_id) r.theme_id = themeMap.get(String(r.theme_id)) ?? null;
        if (r.background_id) r.background_id = mediaMap.get(String(r.background_id)) ?? null;
        add.push(r); taken.add(String(r.id)); titles.add(norm(r.title)); result.songs.added++;
      }
      await insert("songs", add);
      const sections = (await all(src, "sections")).filter((r) => taken.has(String(r.song_id)));
      await insert("sections", sections);
      const sectionIds = new Set(sections.map((r) => String(r.id)));
      const arrangements = (await all(src, "arrangements")).filter((r) => taken.has(String(r.song_id)));
      await insert("arrangements", arrangements);
      const arrangementIds = new Set(arrangements.map((r) => String(r.id)));
      await insert("arrangement_items", (await all(src, "arrangement_items")).filter((r) => arrangementIds.has(String(r.arrangement_id))));
      await insert("translations", (await all(src, "translations")).filter((r) => sectionIds.has(String(r.section_id))));
    }

    // ---- presentations and their slides ----
    {
      const here = await all(dest, "presentations");
      const ids = new Set(here.map((r) => String(r.id)));
      const titles = new Set(here.map((r) => norm(r.title ?? r.name)));
      const taken = new Set<string>();
      const add: Row[] = [];
      for (const r of await all(src, "presentations")) {
        if (ids.has(String(r.id)) || titles.has(norm(r.title ?? r.name))) { result.presentations.skipped++; continue; }
        add.push(r); taken.add(String(r.id)); result.presentations.added++;
      }
      await insert("presentations", add);
      await insert("presentation_slides", (await all(src, "presentation_slides")).filter((r) => taken.has(String(r.presentation_id))));
    }
  } finally {
    src.close();
  }
  return result;
}
