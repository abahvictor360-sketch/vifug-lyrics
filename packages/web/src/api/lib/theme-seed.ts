/**
 * Built-in themes: adding them without ever adding one twice, and tidying up
 * the copies a past race left behind.
 *
 * GET /themes puts back any built-in theme that is missing (so installs seeded
 * before a theme existed pick it up). It used to read the list, notice a name
 * was absent, and insert it - and on a hosted server, where several requests
 * arrive at once, each of them noticed the same absence and each inserted. The
 * result was every built-in picture theme listed twice. The checks here run
 * INSIDE the insert statement, which the database applies one at a time, so
 * the second request finds the row the first one wrote and adds nothing.
 */
import { getTableColumns, sql } from "drizzle-orm";
/** The database is only needed when a request runs, so the pure part below can be tested without one. */
async function store() {
  const [{ db }, schema] = await Promise.all([import("../database"), import("../database/schema")]);
  return { db, schema };
}

type ThemeInsert = typeof import("../database/schema").themes.$inferInsert;

/** Insert a theme unless one with the same name already exists. One atomic statement. */
export async function insertThemeIfMissing(values: ThemeInsert): Promise<void> {
  const { db, schema } = await store();
  const cols = getTableColumns(schema.themes);
  const entries = Object.entries(values).filter(([k, v]) => v !== undefined && k in cols) as [keyof typeof cols, unknown][];
  const names = sql.join(entries.map(([k]) => sql.raw(`"${cols[k]!.name}"`)), sql`, `);
  const params = sql.join(entries.map(([, v]) => sql`${v}`), sql`, `);
  await db.run(
    sql`INSERT INTO "themes" (${names}) SELECT ${params} WHERE NOT EXISTS (SELECT 1 FROM "themes" WHERE "name" = ${values.name})`,
  );
}

/** Add a media row for a bundled picture unless its path is already there. Returns the row's id. */
export async function ensureMediaRow(uri: string, id: string): Promise<string> {
  const { db } = await store();
  await db.run(
    sql`INSERT INTO "media" ("id", "type", "uri", "loop", "fit", "muted", "created_at") SELECT ${id}, 'image', ${uri}, 1, 'cover', 1, ${new Date().toISOString()} WHERE NOT EXISTS (SELECT 1 FROM "media" WHERE "uri" = ${uri})`,
  );
  // If two rows already exist from the old race, the same one is chosen every time.
  const rows = await db.all<{ id: string }>(sql`SELECT "id" FROM "media" WHERE "uri" = ${uri} ORDER BY "id" LIMIT 1`);
  return rows[0]?.id ?? id;
}

type ThemeRow = Record<string, unknown> & { id: string; name: string; backgroundId?: string | null };

/**
 * Which theme rows are redundant copies of a built-in theme and safe to remove.
 *
 * A row is removed only when ALL of these hold: its name is a built-in's,
 * another row of the same name is kept, nothing refers to it (not the active
 * theme, no song), and it is identical to the kept one in every setting - the
 * pictures compared by file path, since the race also duplicated those rows.
 * A theme somebody has edited, or one in use, is never touched.
 */
export function findRedundantThemes(
  rows: ThemeRow[],
  builtinNames: string[],
  mediaUriById: Map<string, string>,
  referencedIds: Set<string>,
): string[] {
  const remove: string[] = [];
  for (const name of builtinNames) {
    const group = rows.filter((r) => r.name === name);
    if (group.length < 2) continue;
    // Keep the one that is in use, else the first.
    const keeper = group.find((r) => referencedIds.has(r.id)) ?? group[0]!;
    const sig = (r: ThemeRow) =>
      JSON.stringify(
        Object.keys(r)
          .filter((k) => k !== "id")
          .sort()
          .map((k) => [k, k === "backgroundId" ? (r.backgroundId ? (mediaUriById.get(r.backgroundId) ?? r.backgroundId) : null) : r[k]]),
      );
    const keeperSig = sig(keeper);
    for (const r of group) {
      if (r.id === keeper.id || referencedIds.has(r.id)) continue;
      if (sig(r) === keeperSig) remove.push(r.id);
    }
  }
  return remove;
}
