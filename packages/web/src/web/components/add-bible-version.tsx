import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, Upload } from "lucide-react";
import { useBibleManifest, forgetVersionCache } from "../hooks/use-bible";
import { parseBibleFile, type ParsedBible } from "../lib/bible-parse";
import { deleteUserVersion, saveUserVersion, type UserBibleVersion } from "../lib/user-bibles";
import { VButton } from "./bits";

const input =
  "w-full rounded-md border border-[var(--v-border)] bg-[var(--v-surface-2)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--v-accent)]";

/** Add a Bible translation from a file, and manage the ones already added on this device. */
export function AddBibleVersion() {
  const qc = useQueryClient();
  const manifest = useBibleManifest();
  const mine = (manifest.data?.versions ?? []).filter((v): v is UserBibleVersion => (v as { user?: boolean }).user === true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedBible | null>(null);
  const [fileName, setFileName] = useState("");
  const [label, setLabel] = useState("");
  const [abbr, setAbbr] = useState("");
  const [language, setLanguage] = useState("English");
  const [lang, setLang] = useState("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["bible", "manifest"] });

  async function onFile(f: File | undefined) {
    if (!f || !manifest.data) return;
    setError(null);
    setParsed(null);
    setBusy(true);
    try {
      const p = parseBibleFile(await f.text(), f.name, manifest.data.canon);
      setParsed(p);
      setFileName(f.name);
      if (!label) setLabel(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
      if (!p.verseCount) setError("No verses could be read from that file.");
    } catch {
      setError("Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!parsed?.verseCount) return;
    setBusy(true);
    setError(null);
    try {
      const short = (abbr || label).trim().slice(0, 10);
      await saveUserVersion({ label: label.trim(), abbr: short.toUpperCase(), language: language.trim() || "English", lang: lang.trim().toLowerCase() || "en" }, parsed.books, parsed.verseCount);
      setParsed(null);
      setFileName("");
      setLabel("");
      setAbbr("");
      await refresh();
    } catch {
      setError("Couldn't save it on this device (is storage full or blocked?).");
    } finally {
      setBusy(false);
    }
  }

  async function remove(v: UserBibleVersion) {
    if (!window.confirm(`Remove ${v.label} from this device?`)) return;
    await deleteUserVersion(v.id);
    forgetVersionCache(v.id);
    await refresh();
  }

  return (
    <div className="mt-4 border-t border-[var(--v-border)] pt-3">
      <p className="mb-1 text-sm font-medium">Add your own Bible version</p>
      <p className="mb-2 text-[12px] text-[var(--v-text-faint)]">
        Import a translation from a file - plain text with one verse a line (&ldquo;John 3:16 For God so loved&hellip;&rdquo;),
        CSV, JSON, or OSIS / USFX / Zefania XML. It stays on this computer and appears in the version dropdown in the Bible
        tab. Only add translations you have the right to use.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.csv,.tsv,.json,.xml,.osis,.usfx,.zefania"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <VButton variant="subtle" size="sm" onClick={() => fileRef.current?.click()} disabled={busy || !manifest.data}>
        <Upload className="h-4 w-4" /> Choose a Bible file
      </VButton>
      {busy && <Loader2 className="ml-2 inline h-4 w-4 animate-spin" />}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {parsed && parsed.verseCount > 0 && (
        <div className="mt-3 space-y-2 rounded-md border border-[var(--v-border)] bg-[var(--v-surface)] p-3">
          <p className="text-[12px]">
            Read <b>{parsed.verseCount.toLocaleString()}</b> verses in <b>{Object.keys(parsed.books).length}</b> books from {fileName}.
          </p>
          {parsed.warnings.map((w, i) => (
            <p key={i} className="text-[12px] text-amber-400">{w}</p>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[12px] text-[var(--v-text-faint)]">
              Name
              <input className={input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Yoruba Bible 1960" />
            </label>
            <label className="text-[12px] text-[var(--v-text-faint)]">
              Short name (shown beside the reference)
              <input className={input} value={abbr} onChange={(e) => setAbbr(e.target.value)} placeholder="e.g. YBC" maxLength={10} />
            </label>
            <label className="text-[12px] text-[var(--v-text-faint)]">
              Language
              <input className={input} value={language} onChange={(e) => setLanguage(e.target.value)} />
            </label>
            <label className="text-[12px] text-[var(--v-text-faint)]">
              Language code
              <input className={input} value={lang} onChange={(e) => setLang(e.target.value)} placeholder="en" maxLength={5} />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <VButton variant="ghost" size="sm" onClick={() => setParsed(null)}>Cancel</VButton>
            <VButton variant="primary" size="sm" onClick={() => void add()} disabled={busy || !label.trim()}>
              Add this version
            </VButton>
          </div>
        </div>
      )}

      {mine.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {mine.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 rounded-md border border-[var(--v-border)] px-2.5 py-1.5">
              <span className="min-w-0 text-sm">
                <span className="block truncate">{v.label}</span>
                <span className="block text-[11px] text-[var(--v-text-faint)]">
                  {v.abbr} · {v.language} · {v.verseCount?.toLocaleString() ?? "?"} verses
                </span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${v.label}`}
                onClick={() => void remove(v)}
                className="rounded p-1 text-[var(--v-text-faint)] hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
