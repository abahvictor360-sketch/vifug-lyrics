/**
 * Bible versions the user added themselves, kept on this device.
 *
 * The built-in versions are static files under /bible; a version someone
 * imports has nowhere on a static host to live, so it goes into IndexedDB and
 * is read back through the same loadBook() door as the built-ins. Ids start
 * with "user-" so the two can never collide.
 */
import type { BibleVersion, BookData } from "../hooks/use-bible";

export const USER_PREFIX = "user-";
export const isUserVersion = (id: string) => id.startsWith(USER_PREFIX);

export type UserBibleVersion = BibleVersion & { user: true; addedAt: number; verseCount: number };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("vifug-user-bibles", 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("versions", { keyPath: "id" });
      r.result.createObjectStore("books");
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

export async function listUserVersions(): Promise<UserBibleVersion[]> {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const g = db.transaction("versions").objectStore("versions").getAll();
      g.onsuccess = () => resolve((g.result as UserBibleVersion[]).sort((a, b) => a.addedAt - b.addedAt));
      g.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function getUserBook(versionId: string, code: string): Promise<BookData | null> {
  const db = await open();
  return new Promise((resolve) => {
    const g = db.transaction("books").objectStore("books").get(`${versionId}/${code}`);
    g.onsuccess = () => resolve((g.result as BookData | undefined) ?? null);
    g.onerror = () => resolve(null);
  });
}

export async function saveUserVersion(
  meta: { label: string; abbr: string; language: string; lang: string },
  books: Record<string, BookData>,
  verseCount: number,
): Promise<UserBibleVersion> {
  const slug = meta.abbr.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12) || "bible";
  const id = `${USER_PREFIX}${slug}-${Date.now().toString(36)}`;
  const codes = Object.keys(books);
  const version: UserBibleVersion = {
    id,
    label: meta.label,
    abbr: meta.abbr,
    language: meta.language,
    lang: meta.lang,
    books: codes,
    chapterCounts: Object.fromEntries(codes.map((c) => [c, Object.keys(books[c]!.c).length ? Math.max(...Object.keys(books[c]!.c).map(Number)) : 0])),
    user: true,
    addedAt: Date.now(),
    verseCount,
  };
  const db = await open();
  const tx = db.transaction(["versions", "books"], "readwrite");
  tx.objectStore("versions").put(version);
  for (const c of codes) tx.objectStore("books").put(books[c], `${id}/${c}`);
  await done(tx);
  return version;
}

export async function deleteUserVersion(id: string): Promise<void> {
  const db = await open();
  const tx = db.transaction(["versions", "books"], "readwrite");
  tx.objectStore("versions").delete(id);
  tx.objectStore("books").delete(IDBKeyRange.bound(`${id}/`, `${id}/￿`));
  await done(tx);
}
