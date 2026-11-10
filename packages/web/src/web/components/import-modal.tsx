import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Upload, FileText, Link2, Loader2, Search } from "lucide-react";
import { api } from "../lib/api";
import { VButton, SectionChip } from "./bits";
import { useDialog } from "../hooks/use-dialog";

type Parsed = { type: string; label: string; number: number | null; lyrics: string };

export function ImportModal({ onClose }: { onClose: (savedId?: string) => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  /** Credits found on an imported page; editable before saving. */
  const [authors, setAuthors] = useState("");
  const [preview, setPreview] = useState<Parsed[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  /** What the last import vetting did or doubted, shown above the text box. */
  const [vet, setVet] = useState<{ verdict: string; changes: string[]; warnings: string[] } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  /** Progress and outcome of a many-file import (a whole ProPresenter library). */
  const [bulk, setBulk] = useState<{
    total: number;
    done: number;
    ok: number;
    /** Already in the library, so left alone. */
    skipped: number;
    failed: { name: string; reason: string }[];
    running: boolean;
  } | null>(null);
  const ewRef = useRef<HTMLInputElement>(null);

  const doFetchLink = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/import/from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link.trim() }),
      });
      const data = (await res.json()) as {
        text?: string;
        title?: string;
        authors?: string[];
        error?: string;
        hint?: string;
        vet?: { verdict: string; changes: string[]; warnings: string[] };
      };
      if (!res.ok) throw new Error([data.error, data.hint].filter(Boolean).join(" ") || "couldn't import that link");
      return data as { text: string; title: string; authors?: string[]; vet?: { verdict: string; changes: string[]; warnings: string[] } };
    },
    onSuccess: (d) => {
      setVet(d.vet ?? null);
      setText(d.text);
      if (!title) setTitle(d.title);
      // Only fill what the operator has not already typed.
      if (!authors && d.authors?.length) setAuthors(d.authors.join(", "));
      setPreview(null);
      setLinkOpen(false);
      setLink("");
    },
  });

  type Hit = {
    id: string;
    title: string;
    artist: string;
    album: string;
    text: string;
    verdict: string;
    changes: string[];
    warnings: string[];
  };
  const doSearch = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/import/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query.trim() }),
      });
      const data = (await res.json()) as { results?: Hit[]; error?: string };
      if (!res.ok) throw new Error(data.error || "search failed");
      return data.results ?? [];
    },
  });
  const applyHit = (h: Hit) => {
    setText(h.text);
    setTitle(h.title);
    if (!authors && h.artist) setAuthors(h.artist);
    setVet({ verdict: h.verdict, changes: h.changes, warnings: h.warnings });
    setPreview(null);
    setSearchOpen(false);
  };

  const doPreview = useMutation({
    mutationFn: async () => {
      const res = await api.import.preview.$post({ json: { text, title } });
      return (await res.json()) as { title: string; sections: Parsed[] };
    },
    onSuccess: (d) => {
      setPreview(d.sections);
      if (!title) setTitle(d.title);
    },
  });

  const doImportText = useMutation({
    mutationFn: async () => {
      const res = await api.import.$post({
        json: {
          text,
          title,
          authors: authors.split(",").map((a) => a.trim()).filter(Boolean),
        },
      });
      return (await res.json()) as { id: string };
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["songs"] });
      onClose(d.id);
    },
  });

  const doImportFile = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      if (title) fd.append("title", title);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      return (await res.json()) as { id: string };
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["songs"] });
      onClose(d.id);
    },
  });

  /**
   * Run a list of imports in order, reporting as it goes.
   *
   * One request each, sequentially, on purpose: a bad item is named and
   * skipped instead of sinking the rest, songs are filed in the order they
   * were picked, and a few hundred requests at once is a good way to get the
   * later ones refused. Each job returns "skipped" for a song that is already
   * in the library.
   */
  const runBulk = async (jobs: { name: string; run: () => Promise<"ok" | "skipped"> }[]) => {
    const state = { total: jobs.length, done: 0, ok: 0, skipped: 0, failed: [] as { name: string; reason: string }[], running: true };
    const publish = () => setBulk({ ...state, failed: [...state.failed] });
    publish();
    for (const job of jobs) {
      try {
        const r = await job.run();
        if (r === "skipped") state.skipped += 1;
        else state.ok += 1;
      } catch (e) {
        state.failed.push({ name: job.name, reason: e instanceof Error ? e.message : "failed" });
      }
      state.done += 1;
      publish();
    }
    state.running = false;
    publish();
    qc.invalidateQueries({ queryKey: ["songs"] });
  };

  const uploadFile = async (file: File): Promise<"ok"> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/import", { method: "POST", body: fd });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(d.error || `error ${res.status}`);
    }
    return "ok";
  };

  const importMany = (files: File[]) =>
    runBulk(files.map((f) => ({ name: f.name, run: () => uploadFile(f) })));

  /**
   * An EasyWorship 6/7 library: Songs.db and SongWords.db picked together.
   * Read in the browser (nothing is uploaded but the songs themselves), then
   * filed through the same text import as a pasted song. Songs already in
   * the library, by title and first author, are skipped - so moving the
   * library twice does not double it.
   */
  const importEasyWorship = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    const songsFile = files.find((f) => /^songs\.db$/i.test(f.name));
    const wordsFile = files.find((f) => /^songwords\.db$/i.test(f.name));
    if (!songsFile || !wordsFile) {
      setBulk({
        total: 1, done: 1, ok: 0, skipped: 0, running: false,
        failed: [{ name: "EasyWorship", reason: "pick both Songs.db and SongWords.db together" }],
      });
      return;
    }
    setBulk({ total: 0, done: 0, ok: 0, skipped: 0, failed: [], running: true });
    try {
      const [{ loadSqlJs }, { readEasyWorshipLibrary }] = await Promise.all([
        import("../lib/sqljs-loader"),
        import("../lib/easyworship"),
      ]);
      const [SQL, songsBuf, wordsBuf] = await Promise.all([
        loadSqlJs(),
        songsFile.arrayBuffer(),
        wordsFile.arrayBuffer(),
      ]);
      const lib = readEasyWorshipLibrary(SQL, songsBuf, wordsBuf);

      const key = (title: string, author: string | undefined) =>
        `${title}|${author ?? ""}`.toLowerCase().replace(/[^\p{L}\p{N}|]+/gu, "");
      const have = new Set<string>();
      const existing = await fetch("/api/songs");
      if (existing.ok) {
        const d = (await existing.json()) as { songs: { title: string; authors: string[] }[] };
        for (const s of d.songs) have.add(key(s.title, s.authors[0]));
      }

      await runBulk(
        lib.songs.map((song) => ({
          name: song.title,
          run: async () => {
            const k = key(song.title, song.authors[0]);
            if (have.has(k)) return "skipped" as const;
            const res = await fetch("/api/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: song.text, title: song.title, authors: song.authors }),
            });
            if (!res.ok) {
              const d = (await res.json().catch(() => ({}))) as { error?: string };
              throw new Error(d.error || `error ${res.status}`);
            }
            have.add(k);
            return "ok" as const;
          },
        })),
      );
      if (lib.skipped > 0) {
        setBulk((b) =>
          b ? { ...b, failed: [...b.failed, { name: `${lib.skipped} songs with no words`, reason: "left out" }] } : b,
        );
      }
    } catch (e) {
      setBulk({
        total: 1, done: 1, ok: 0, skipped: 0, running: false,
        failed: [{ name: "EasyWorship", reason: e instanceof Error ? e.message : "could not read the library" }],
      });
    }
  };

  const onFiles = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    // One plain-text file still opens in the editor for review; everything
    // else (several files, or ProPresenter / Word documents) imports directly.
    if (files.length === 1 && files[0].name.toLowerCase().endsWith(".txt")) void onFile(files[0]);
    else void importMany(files);
  };

  const onFile = async (file: File) => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".txt")) {
      const t = await file.text();
      setText(t);
      if (!title) setTitle(file.name.replace(/\.txt$/i, ""));
    } else {
      // docx: send straight to server
      doImportFile.mutate(file);
    }
  };

  const dialog = useDialog();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div ref={dialog.ref} {...dialog.dialogProps} aria-labelledby="import-song-title" className="focus:outline-none flex h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--v-border)] bg-[var(--v-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--v-border)] px-5 py-3">
          <h2 id="import-song-title" className="font-display text-lg font-semibold">Import Song</h2>
          <button onClick={() => onClose()} aria-label="Close import" className="text-[var(--v-text-faint)] hover:text-[var(--v-text)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="v-scroll grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
          <div className="flex flex-col">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional - auto-detected)"
              className="mb-2 w-full rounded-md border border-[var(--v-border)] bg-[var(--v-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--v-accent)]"
            />
            {/* Filled in from the page when a link is imported, and editable:
                a credit read off markup is a good guess, not a fact. */}
            <input
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              placeholder="Author / artist (optional - auto-detected)"
              className="mb-2 w-full rounded-md border border-[var(--v-border)] bg-[var(--v-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--v-accent)]"
            />
            <div className="mb-2 flex items-center gap-2">
              <VButton variant="subtle" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Choose files (.txt / .docx / ProPresenter)
              </VButton>
              <VButton variant="subtle" size="sm" onClick={() => ewRef.current?.click()}>
                <Upload className="h-4 w-4" /> EasyWorship library
              </VButton>
              <VButton variant="subtle" size="sm" onClick={() => setLinkOpen((v) => !v)}>
                <Link2 className="h-4 w-4" /> From a link
              </VButton>
              <VButton variant="subtle" size="sm" onClick={() => setSearchOpen((v) => !v)}>
                <Search className="h-4 w-4" /> Search online
              </VButton>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.docx,.pro6,.pro"
                multiple
                className="hidden"
                onChange={(e) => {
                  onFiles(e.target.files);
                  // So picking the same files again still fires a change.
                  e.target.value = "";
                }}
              />
              <input
                ref={ewRef}
                type="file"
                accept=".db"
                multiple
                className="hidden"
                onChange={(e) => {
                  void importEasyWorship(e.target.files);
                  e.target.value = "";
                }}
              />
              {doImportFile.isPending && <span className="text-xs text-[var(--v-text-faint)]">Uploading…</span>}
            </div>
            {bulk && (
              <div role="status" className="mb-2 rounded-md border border-[var(--v-border)] bg-[var(--v-surface-2)] p-2.5 text-xs">
                <p>
                  {bulk.running
                    ? bulk.total ? `Importing ${bulk.done} of ${bulk.total}…` : "Reading the library…"
                    : `Imported ${bulk.ok} song${bulk.ok === 1 ? "" : "s"}${bulk.skipped ? `, ${bulk.skipped} already in the library` : ""}.`}
                </p>
                {bulk.failed.length > 0 && (
                  <ul className="v-scroll mt-1.5 max-h-28 space-y-0.5 overflow-y-auto text-red-400">
                    {bulk.failed.map((f, i) => (
                      <li key={i}>
                        {f.name} - {f.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {linkOpen && (
              <div className="mb-2 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && link.trim() && doFetchLink.mutate()}
                    placeholder="Paste a link to a lyrics page…"
                    className="flex-1 rounded-md border border-[var(--v-border)] bg-[var(--v-surface-2)] px-3 py-1.5 text-sm outline-none focus:border-[var(--v-accent)]"
                  />
                  <VButton
                    variant="subtle"
                    size="sm"
                    onClick={() => doFetchLink.mutate()}
                    disabled={!link.trim() || doFetchLink.isPending}
                  >
                    {doFetchLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
                  </VButton>
                </div>
                {doFetchLink.isError && (
                  <p className="text-xs text-red-400">{(doFetchLink.error as Error).message}</p>
                )}
              </div>
            )}
            {searchOpen && (
              <div className="mb-2 flex flex-col gap-1.5 rounded-md border border-[var(--v-border)] bg-[var(--v-surface-2)] p-2">
                <div className="flex items-center gap-2">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && query.trim().length > 1 && doSearch.mutate()}
                    placeholder="Song name, and artist if you know it…"
                    className="flex-1 rounded-md border border-[var(--v-border)] bg-[var(--v-bg)] px-3 py-1.5 text-sm outline-none focus:border-[var(--v-accent)]"
                  />
                  <VButton variant="subtle" size="sm" onClick={() => doSearch.mutate()} disabled={query.trim().length < 2 || doSearch.isPending}>
                    {doSearch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                  </VButton>
                </div>
                {doSearch.isError && <p className="text-xs text-red-400">{(doSearch.error as Error).message}</p>}
                {doSearch.data && doSearch.data.length === 0 && (
                  <p className="text-xs text-[var(--v-text-faint)]">No songs with words found. Try the title alone, or paste the words.</p>
                )}
                {doSearch.data && doSearch.data.length > 0 && (
                  <ul className="v-scroll max-h-56 space-y-1 overflow-y-auto">
                    {doSearch.data.map((h) => (
                      <li key={h.id} className="flex items-start gap-2 rounded border border-[var(--v-border)] bg-[var(--v-bg)] p-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{h.title}</p>
                          <p className="truncate text-[11px] text-[var(--v-text-faint)]">
                            {[h.artist, h.album].filter(Boolean).join(" · ")}
                          </p>
                          <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-[11px] text-[var(--v-text-faint)]">
                            {h.text.split("\n").filter(Boolean).slice(0, 2).join("\n")}
                          </p>
                          {h.verdict !== "good" && (
                            <p className="mt-0.5 text-[11px] text-amber-400">{h.warnings[0] ?? "Check this one."}</p>
                          )}
                        </div>
                        <VButton variant="subtle" size="sm" onClick={() => applyHit(h)}>
                          Use
                        </VButton>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] text-[var(--v-text-faint)]">
                  Results come from the open LRCLIB database. Most current songs are copyrighted: make sure your church
                  or event holds the licence to display them (for example CCLI) before using one.
                </p>
              </div>
            )}
            {vet && (vet.changes.length > 0 || vet.warnings.length > 0) && (
              <div
                role="status"
                className={`mb-2 rounded-md border p-2 text-xs ${
                  vet.verdict === "good" ? "border-[var(--v-border)] bg-[var(--v-surface-2)]" : "border-amber-500/50 bg-amber-500/10"
                }`}
              >
                {vet.warnings.map((w, i) => (
                  <p key={`w${i}`} className="text-amber-400">{w}</p>
                ))}
                {vet.changes.map((c, i) => (
                  <p key={`c${i}`} className="text-[var(--v-text-faint)]">{c}</p>
                ))}
              </div>
            )}
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setPreview(null);
              }}
              placeholder={"Paste lyrics here.\n\nBlank lines separate sections.\nHeaders like 'Chorus', 'Verse 2', 'Bridge' are recognized."}
              className="v-scroll min-h-[260px] flex-1 resize-none rounded-md border border-[var(--v-border)] bg-[var(--v-bg)] px-3 py-2 font-lyric text-sm leading-relaxed outline-none focus:border-[var(--v-accent)]"
            />
          </div>

          <div className="flex flex-col">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--v-text-faint)]">Detected structure</span>
              <VButton variant="ghost" size="sm" onClick={() => doPreview.mutate()} disabled={!text.trim() || doPreview.isPending}>
                {doPreview.isPending ? "Parsing…" : "Preview"}
              </VButton>
            </div>
            <div className="v-scroll flex-1 space-y-2 overflow-y-auto rounded-md border border-[var(--v-border)] bg-[var(--v-surface-2)] p-3">
              {!preview && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-[var(--v-text-faint)]">
                  <FileText className="h-6 w-6" />
                  <p className="text-xs">Paste or upload, then Preview to see detected sections.</p>
                </div>
              )}
              {preview?.map((s, i) => (
                <div key={i} className="rounded border border-[var(--v-border)] bg-[var(--v-surface)] p-2">
                  <SectionChip label={s.label} type={s.type} />
                  <pre className="mt-1.5 whitespace-pre-wrap font-lyric text-xs leading-snug text-[var(--v-text-dim)]">{s.lyrics}</pre>
                </div>
              ))}
              {preview && preview.length === 0 && (
                <p className="text-xs text-[var(--v-text-faint)]">No sections detected.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--v-border)] px-5 py-3">
          <VButton variant="ghost" onClick={() => onClose()}>Cancel</VButton>
          <VButton
            variant="primary"
            onClick={() => doImportText.mutate()}
            disabled={!text.trim() || doImportText.isPending}
          >
            {doImportText.isPending ? "Importing…" : "Import to library"}
          </VButton>
        </div>
      </div>
    </div>
  );
}
