import { useEffect, useMemo, useRef, useState } from "react";
import { Search, BookOpen, Play, Eye } from "lucide-react";
import {
  useBibleManifest, useChapter, bookName, parseReference, searchVersion,
  type BibleVersion, type SearchHit,
} from "../hooks/use-bible";
import type { StageSlide } from "../lib/stage";
import { Spinner } from "./bits";

/** Build a bible StageSlide for a single verse. */
export function verseSlide(
  version: BibleVersion,
  code: string,
  name: string,
  chapter: number,
  verse: number,
  text: string,
  slideIndex: number,
  slideCount: number,
): StageSlide {
  return {
    kind: "bible",
    sourceLines: [text],
    translationLines: [],
    caption: `${name} ${chapter}:${verse}`,
    title: version.label,
    slideId: `${version.id}-${code}-${chapter}-${verse}`,
    slideIndex,
    slideCount,
  };
}

/**
 * Bible browser. Owns version / book / chapter / verse navigation and search.
 * It computes the "active" ordered slide list (a whole chapter, or search hits)
 * and lifts it to the operator via onSlidesChange so the shared stage can
 * preview/send exactly what is on screen. previewId/liveId drive highlighting.
 */
export type BibleLangToggles = { yor: boolean; hau: boolean; ibo: boolean };

export function BiblePanel({
  onSlidesChange,
  onPreview,
  onSendLive,
  previewId,
  liveId,
  langs,
  cue,
}: {
  onSlidesChange: (slides: StageSlide[]) => void;
  onPreview: (index: number) => void;
  onSendLive: (index: number) => void;
  previewId: string | null;
  liveId: string | null;
  /** Language packs enabled in Settings → Bible. */
  langs: BibleLangToggles;
  /** External navigation request (e.g. cued from a service plan). */
  cue?: { versionId?: string; ref: string; nonce: number } | null;
}) {
  const manifest = useBibleManifest();
  const allVersions = manifest.data?.versions ?? [];
  // English core is always on; other language packs are gated by settings.
  // Version ids yor/hau/ibo map directly to the toggle keys.
  const versions = allVersions.filter(
    (v) => v.lang === "en" || (langs as Record<string, boolean>)[v.id] !== false,
  );
  const [versionId, setVersionId] = useState<string>("");
  useEffect(() => {
    // Pick a default, and fall back to the first enabled version if the current
    // one was just toggled off.
    if (!versions.length) return;
    if (!versionId || !versions.some((v) => v.id === versionId)) {
      setVersionId(versions[0].id);
    }
  }, [versions, versionId]);
  const version = versions.find((v) => v.id === versionId);

  const [code, setCode] = useState("JHN");
  const [chapter, setChapter] = useState(3);

  const chapterCount = version?.chapterCounts[code] ?? 0;
  useEffect(() => {
    // Only clamp once the version manifest is loaded (chapterCount > 0),
    // otherwise the default chapter gets reset before counts are known.
    if (chapterCount > 0 && chapter > chapterCount) setChapter(1);
  }, [chapterCount, chapter]);

  const chapterQ = useChapter(versionId || null, code, chapter);
  const verses = chapterQ.data ?? [];
  const name = bookName(manifest.data, code);

  /* ---- search ---- */
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!version || !manifest.data || query.trim().length < 2) {
      setHits(null);
      setSearching(false);
      return;
    }
    // Instant jump when the query is a reference like "John 3:16".
    const ref = parseReference(query, manifest.data);
    if (ref && version.books.includes(ref.code)) {
      setHits(null);
      setSearching(false);
      setCode(ref.code);
      setChapter(ref.chapter);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const res = await searchVersion(version, manifest.data!, query);
      setHits(res);
      setSearching(false);
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, version, manifest.data]);

  // React to an external cue (from a service plan): jump to the version/ref.
  useEffect(() => {
    if (!cue || !manifest.data) return;
    if (cue.versionId && versions.some((v) => v.id === cue.versionId)) {
      setVersionId(cue.versionId);
    }
    const ref = parseReference(cue.ref, manifest.data);
    if (ref) {
      setQuery("");
      setHits(null);
      setCode(ref.code);
      setChapter(ref.chapter);
    } else {
      setQuery(cue.ref);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue?.nonce]);

  // The ordered slide list currently shown: search hits (if any) else chapter.
  const activeSlides = useMemo<StageSlide[]>(() => {
    if (!version) return [];
    if (hits) {
      return hits.map((h, i) =>
        verseSlide(version, h.code, h.name, h.chapter, h.verse, h.text, i, hits.length),
      );
    }
    return verses.map((text, i) =>
      verseSlide(version, code, name, chapter, i + 1, text, i, verses.length),
    );
  }, [version, hits, verses, code, name, chapter]);

  // Lift the visible slide list so the shared stage previews/sends the same set.
  useEffect(() => {
    onSlidesChange(activeSlides);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlides]);

  if (manifest.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-[var(--v-text-faint)]">
        <Spinner /> Loading Bible…
      </div>
    );
  }
  if (manifest.isError || !version) {
    return <div className="p-6 text-sm text-[var(--v-text-faint)]">Bible data unavailable.</div>;
  }

  const books = manifest.data!.canon.filter((b) => version.books.includes(b.code));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Controls */}
      <div className="space-y-2 border-b border-[var(--v-border)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
            className="rounded-md border border-[var(--v-border)] bg-[var(--v-surface-2)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--v-accent)]"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>

          <select
            value={code}
            onChange={(e) => { setCode(e.target.value); setChapter(1); setQuery(""); setHits(null); }}
            className="rounded-md border border-[var(--v-border)] bg-[var(--v-surface-2)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--v-accent)]"
          >
            {books.map((b) => (
              <option key={b.code} value={b.code}>{b.name}</option>
            ))}
          </select>

          <select
            value={chapter}
            onChange={(e) => { setChapter(Number(e.target.value)); setQuery(""); setHits(null); }}
            className="rounded-md border border-[var(--v-border)] bg-[var(--v-surface-2)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--v-accent)]"
          >
            {Array.from({ length: chapterCount }, (_, i) => i + 1).map((c) => (
              <option key={c} value={c}>Ch {c}</option>
            ))}
          </select>

          <span className="ml-auto text-[11px] text-[var(--v-text-faint)]">
            More versions in Settings → Bible
          </span>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--v-text-faint)]" />
          {searching && <Spinner className="absolute right-2.5 top-1/2 -translate-y-1/2" />}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search text or jump to reference (e.g. John 3:16)…"
            className="w-full rounded-md border border-[var(--v-border)] bg-[var(--v-surface-2)] py-2 pl-8 pr-8 text-sm outline-none focus:border-[var(--v-accent)]"
          />
        </div>
      </div>

      {/* Verse / result list */}
      <div className="v-scroll min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--v-text-dim)]">
          <BookOpen className="h-4 w-4" />
          {hits ? `${hits.length} result${hits.length === 1 ? "" : "s"}` : `${name} ${chapter}`}
          {chapterQ.isFetching && !hits && <Spinner />}
        </div>
        {hits && !hits.length ? (
          <p className="px-1 py-8 text-center text-sm text-[var(--v-text-faint)]">No verses found.</p>
        ) : (
          <ul className="space-y-1">
            {activeSlides.map((s, i) => {
              const isLive = liveId === s.slideId;
              const isPreview = previewId === s.slideId;
              return (
                <li key={s.slideId}>
                  <div
                    className={`group flex items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
                      isLive
                        ? "border-[var(--v-live)] bg-[var(--v-live-soft)]"
                        : isPreview
                          ? "border-[var(--v-accent)] bg-[var(--v-accent-soft)]"
                          : "border-transparent hover:bg-[var(--v-surface-3)]"
                    }`}
                  >
                    <button
                      className="flex flex-1 items-start gap-2 text-left"
                      onClick={() => onPreview(i)}
                      onDoubleClick={() => onSendLive(i)}
                    >
                      <span className="mt-0.5 shrink-0 text-right text-[11px] font-semibold text-[var(--v-accent)]">
                        {hits ? `${s.caption}` : i + 1}
                      </span>
                      <span className="font-lyric text-sm leading-snug text-[var(--v-text)]">{s.sourceLines[0]}</span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button title="Preview" onClick={() => onPreview(i)} className="rounded p-1 text-[var(--v-text-faint)] hover:text-[var(--v-accent)]">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button title="Send live" onClick={() => onSendLive(i)} className="rounded p-1 text-[var(--v-text-faint)] hover:text-[var(--v-live)]">
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
