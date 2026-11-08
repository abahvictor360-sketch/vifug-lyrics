import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Upload, FileText, Link2, Loader2 } from "lucide-react";
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
  /** Progress and outcome of a many-file import (a whole ProPresenter library). */
  const [bulk, setBulk] = useState<{
    total: number;
    done: number;
    ok: number;
    failed: { name: string; reason: string }[];
    running: boolean;
  } | null>(null);

  const doFetchLink = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/import/from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link.trim() }),
      });
      const data = (await res.json()) as { text?: string; title?: string; authors?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error || "couldn't import that link");
      return data as { text: string; title: string; authors?: string[] };
    },
    onSuccess: (d) => {
      setText(d.text);
      if (!title) setTitle(d.title);
      // Only fill what the operator has not already typed.
      if (!authors && d.authors?.length) setAuthors(d.authors.join(", "));
      setPreview(null);
      setLinkOpen(false);
      setLink("");
    },
  });

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
   * Many files at once: one request each, in order, so a bad file is named
   * and skipped instead of sinking the rest. Sequential on purpose - the
   * songs are filed in the order they were picked, and a few hundred small
   * uploads at once is a good way to get the later ones refused.
   */
  const importMany = async (files: File[]) => {
    const state = { total: files.length, done: 0, ok: 0, failed: [] as { name: string; reason: string }[], running: true };
    setBulk({ ...state });
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/import", { method: "POST", body: fd });
        if (res.ok) state.ok += 1;
        else {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          state.failed.push({ name: file.name, reason: d.error || `error ${res.status}` });
        }
      } catch {
        state.failed.push({ name: file.name, reason: "upload failed" });
      }
      state.done += 1;
      setBulk({ ...state, failed: [...state.failed] });
    }
    state.running = false;
    setBulk({ ...state, failed: [...state.failed] });
    qc.invalidateQueries({ queryKey: ["songs"] });
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
              <VButton variant="subtle" size="sm" onClick={() => setLinkOpen((v) => !v)}>
                <Link2 className="h-4 w-4" /> From a link
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
              {doImportFile.isPending && <span className="text-xs text-[var(--v-text-faint)]">Uploading…</span>}
            </div>
            {bulk && (
              <div role="status" className="mb-2 rounded-md border border-[var(--v-border)] bg-[var(--v-surface-2)] p-2.5 text-xs">
                <p>
                  {bulk.running
                    ? `Importing ${bulk.done} of ${bulk.total}…`
                    : `Imported ${bulk.ok} of ${bulk.total} songs.`}
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
