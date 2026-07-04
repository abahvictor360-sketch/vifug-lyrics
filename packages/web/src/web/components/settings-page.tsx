import { useEffect, useRef, useState } from "react";
import {
  X, Music4, BookOpen, Settings2, Image as ImageIcon, Upload, Loader2,
  Trash2, Film, Palette, Link2, Monitor, Ear, Type, LayoutList, Languages,
} from "lucide-react";
import { VButton } from "./bits";
import { SlideRender } from "./slide-render";
import type { AppSettings, ThemeOverride } from "../hooks/use-settings";
import { useMedia, useAddMediaUrl, useDeleteMedia, useUploadMedia, type MediaItem } from "../hooks/use-media";
import { LANGS } from "../hooks/use-translations";
import type { LiveState, LiveTheme } from "../lib/live-bus";
import type { useDesktop } from "../hooks/use-desktop";
import type { DisplayInfo } from "../lib/desktop";

/**
 * Full app settings — side-nav layout. All display configuration lives here:
 *   Lyrics  → theme, background, font, size, alignment, lines per slide, dual language
 *   Bible   → language packs + Bible-only display overrides
 *   General → output display, auto-follow, output links
 */

type SectionId = "lyrics" | "bible" | "general";

const SECTIONS: { id: SectionId; label: string; icon: typeof Music4; hint: string }[] = [
  { id: "lyrics", label: "Lyrics", icon: Music4, hint: "Theme, background & fonts" },
  { id: "bible", label: "Bible", icon: BookOpen, hint: "Versions & scripture look" },
  { id: "general", label: "General", icon: Settings2, hint: "Output & app behavior" },
];

export const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "Archivo (default)", value: "" },
  { label: "Sora", value: '"Sora", system-ui, sans-serif' },
  { label: "IBM Plex Sans", value: '"IBM Plex Sans", system-ui, sans-serif' },
  { label: "Georgia", value: 'Georgia, "Times New Roman", serif' },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Impact", value: 'Impact, "Arial Black", sans-serif' },
  { label: "Courier New", value: '"Courier New", Courier, monospace' },
];

function sampleState(theme: LiveTheme, lines: string[]): LiveState {
  return {
    status: "live",
    sourceLines: lines,
    translationLines: [],
    sectionLabel: "",
    songTitle: "",
    slideId: null,
    slideIndex: 0,
    slideCount: 1,
    theme,
    rev: 0,
  };
}

export function SettingsPage({
  onClose,
  settings,
  patchSettings,
  themes,
  desktop,
  lyricPreviewTheme,
  biblePreviewTheme,
}: {
  onClose: () => void;
  settings: AppSettings | undefined;
  patchSettings: (p: Partial<AppSettings>) => void;
  themes: { id: string; name: string }[];
  desktop: ReturnType<typeof useDesktop>;
  /** Fully merged lyric theme (theme + overrides + background) for previews. */
  lyricPreviewTheme: LiveTheme;
  /** Fully merged Bible theme for previews. */
  biblePreviewTheme: LiveTheme;
}) {
  const [section, setSection] = useState<SectionId>("lyrics");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-8">
      <div className="flex h-full w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--v-border)] bg-[var(--v-surface)] shadow-2xl">
        {/* Side nav */}
        <nav className="flex w-52 shrink-0 flex-col border-r border-[var(--v-border)] bg-[var(--v-surface-2)]">
          <div className="flex items-center gap-2 px-4 py-4">
            <Settings2 className="h-4 w-4 text-[var(--v-accent)]" />
            <span className="font-display text-sm font-bold tracking-tight">Settings</span>
          </div>
          <div className="flex flex-col gap-0.5 px-2">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = section === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "bg-[var(--v-accent-soft)] text-[var(--v-accent)]"
                      : "text-[var(--v-text-dim)] hover:bg-[var(--v-surface-3)] hover:text-[var(--v-text)]"
                  }`}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{s.label}</span>
                    <span className={`block truncate text-[10px] ${active ? "text-[var(--v-accent)]/70" : "text-[var(--v-text-faint)]"}`}>
                      {s.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto px-4 py-3 text-[10px] text-[var(--v-text-faint)]">
            Changes apply instantly.
          </div>
        </nav>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-[var(--v-border)] px-6 py-3.5">
            <h2 className="font-display text-lg font-semibold capitalize">{section === "general" ? "General" : section}</h2>
            <button onClick={onClose} className="rounded-md p-1 text-[var(--v-text-faint)] hover:bg-[var(--v-surface-3)] hover:text-[var(--v-text)]">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="v-scroll min-h-0 flex-1 overflow-y-auto p-6">
            {section === "lyrics" && (
              <LyricsSection
                settings={settings}
                patchSettings={patchSettings}
                themes={themes}
                previewTheme={lyricPreviewTheme}
              />
            )}
            {section === "bible" && (
              <BibleSection settings={settings} patchSettings={patchSettings} previewTheme={biblePreviewTheme} />
            )}
            {section === "general" && (
              <GeneralSection settings={settings} patchSettings={patchSettings} desktop={desktop} />
            )}
          </div>

          <div className="flex justify-end border-t border-[var(--v-border)] px-6 py-3">
            <VButton variant="primary" onClick={onClose}>Done</VButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- shared bits ---------------- */

function Group({ title, icon: Icon, children }: { title: string; icon?: typeof Music4; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--v-text-faint)]">
        {Icon && <Icon className="h-3.5 w-3.5" />} {title}
      </h3>
      <div className="rounded-xl border border-[var(--v-border)] bg-[var(--v-surface-2)] p-4">{children}</div>
    </section>
  );
}

function PreviewStrip({ theme, lines }: { theme: LiveTheme; lines: string[] }) {
  return (
    <div className="relative mb-6 aspect-[21/6] w-full overflow-hidden rounded-xl border border-[var(--v-border)]" style={{ background: "#000" }}>
      <SlideRender state={sampleState(theme, lines)} scale />
      <span className="absolute right-2 top-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/60">
        Live preview
      </span>
    </div>
  );
}

/**
 * Shared look-and-feel editor for a ThemeOverride (used by Lyrics and Bible).
 * undefined = inherit; null fontSize = auto-fit.
 */
function OverrideEditor({
  value,
  onChange,
  inheritLabel,
}: {
  value: ThemeOverride | null | undefined;
  onChange: (next: ThemeOverride) => void;
  inheritLabel: string;
}) {
  const o = value ?? {};
  const set = (patch: ThemeOverride) => onChange({ ...o, ...patch });
  const isLowerThird = o.displayMode === "lower_third" || o.displayMode === "lower_third_bg";

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--v-text-faint)]">Display mode</span>
        <div className="flex gap-1.5">
          {([
            { v: "fullscreen", l: "Fullscreen" },
            { v: "lower_third", l: "Lower third" },
            { v: "lower_third_bg", l: "Lower third + bar" },
          ] as const).map((m) => (
            <button
              key={m.v}
              onClick={() =>
                set(
                  o.displayMode === m.v
                    ? { displayMode: undefined } // back to inherit
                    : {
                        displayMode: m.v,
                        // default the classic broadcast position when entering lower third
                        ...(m.v !== "fullscreen" && !o.verticalPos ? { verticalPos: "bottom" } : {}),
                      },
                )
              }
              className={`flex-1 rounded-md border py-2 text-xs transition-colors ${
                o.displayMode === m.v
                  ? "border-[var(--v-accent)] bg-[var(--v-accent-soft)] text-[var(--v-accent)]"
                  : "border-[var(--v-border)] bg-[var(--v-surface-3)] text-[var(--v-text-dim)] hover:text-[var(--v-text)]"
              }`}
            >
              {m.l}
            </button>
          ))}
        </div>
        {!o.displayMode && (
          <span className="mt-1 block text-[10px] text-[var(--v-text-faint)]">{inheritLabel}. Pick one to override.</span>
        )}
      </label>

      {isLowerThird && (
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--v-text-faint)]">Lower third position</span>
          <div className="flex gap-1.5">
            {([
              { v: "top", l: "Top" },
              { v: "center", l: "Middle" },
              { v: "bottom", l: "Bottom" },
            ] as const).map((p) => (
              <button
                key={p.v}
                onClick={() => set({ verticalPos: p.v })}
                className={`flex-1 rounded-md border py-2 text-xs transition-colors ${
                  (o.verticalPos ?? "bottom") === p.v
                    ? "border-[var(--v-accent)] bg-[var(--v-accent-soft)] text-[var(--v-accent)]"
                    : "border-[var(--v-border)] bg-[var(--v-surface-3)] text-[var(--v-text-dim)] hover:text-[var(--v-text)]"
                }`}
              >
                {p.l}
              </button>
            ))}
          </div>
        </label>
      )}

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--v-text-faint)]">Font</span>
          <select
            value={o.fontFamily ?? ""}
            onChange={(e) => set({ fontFamily: e.target.value || null })}
            className="w-full rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)] px-2 py-2 text-sm outline-none focus:border-[var(--v-accent)]"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.label} value={f.value} style={{ fontFamily: f.value || undefined }}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--v-text-faint)]">Font size (px)</span>
          <input
            type="number"
            min={0}
            placeholder="auto"
            value={o.fontSize ?? ""}
            onChange={(e) => set({ fontSize: e.target.value ? Number(e.target.value) : null })}
            className="w-full rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)] px-2 py-2 text-sm outline-none focus:border-[var(--v-accent)]"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--v-text-faint)]">Font weight</span>
          <select
            value={o.fontWeight ?? ""}
            onChange={(e) => set({ fontWeight: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)] px-2 py-2 text-sm outline-none focus:border-[var(--v-accent)]"
          >
            <option value="">{inheritLabel}</option>
            {[400, 500, 600, 700, 800].map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--v-text-faint)]">Alignment</span>
          <div className="flex gap-1.5">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                onClick={() => set({ textAlign: o.textAlign === a ? undefined : a })}
                className={`flex-1 rounded-md border py-2 text-xs capitalize transition-colors ${
                  o.textAlign === a
                    ? "border-[var(--v-accent)] bg-[var(--v-accent-soft)] text-[var(--v-accent)]"
                    : "border-[var(--v-border)] bg-[var(--v-surface-3)] text-[var(--v-text-dim)] hover:text-[var(--v-text)]"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ColorField
          label="Text color"
          value={o.textColor ?? null}
          fallback="#ffffff"
          onChange={(v) => set({ textColor: v })}
        />
        <ColorField
          label="Background color"
          value={o.bgColor ?? null}
          fallback="#0a0a0c"
          onChange={(v) => set({ bgColor: v })}
        />
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string | null;
  fallback: string;
  onChange: (v: string | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--v-text-faint)]">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value ?? fallback}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-[var(--v-border)] bg-transparent"
        />
        <span className="text-xs text-[var(--v-text-dim)]">{value ?? "inherit"}</span>
        {value && (
          <button onClick={() => onChange(null)} className="ml-auto text-[10px] text-[var(--v-text-faint)] underline-offset-2 hover:text-[var(--v-text)] hover:underline">
            reset
          </button>
        )}
      </div>
    </label>
  );
}

/* ---------------- Lyrics ---------------- */

function LyricsSection({
  settings,
  patchSettings,
  themes,
  previewTheme,
}: {
  settings: AppSettings | undefined;
  patchSettings: (p: Partial<AppSettings>) => void;
  themes: { id: string; name: string }[];
  previewTheme: LiveTheme;
}) {
  const linesPerSlide = settings?.linesPerSlide ?? 2;
  return (
    <div>
      <PreviewStrip theme={previewTheme} lines={["Amazing grace, how sweet the sound", "That saved a wretch like me"]} />

      <Group title="Theme" icon={Palette}>
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--v-text-faint)]">Base theme</span>
          <select
            value={settings?.activeThemeId ?? ""}
            onChange={(e) => patchSettings({ activeThemeId: e.target.value || null })}
            className="w-full rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)] px-3 py-2 text-sm outline-none focus:border-[var(--v-accent)]"
          >
            {themes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
      </Group>

      <Group title="Look & feel" icon={Type}>
        <OverrideEditor
          value={settings?.lyricTheme}
          onChange={(next) => patchSettings({ lyricTheme: next })}
          inheritLabel="Theme default"
        />
      </Group>

      <Group title="Background" icon={ImageIcon}>
        <BackgroundsEditor
          activeId={settings?.activeBackgroundId ?? null}
          onSelect={(id) => patchSettings({ activeBackgroundId: id })}
        />
      </Group>

      <Group title="Slides" icon={LayoutList}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm">Lines per slide</span>
          <span className="rounded bg-[var(--v-accent-soft)] px-1.5 py-0.5 text-xs font-semibold text-[var(--v-accent)]">
            {linesPerSlide}
          </span>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              onClick={() => patchSettings({ linesPerSlide: n })}
              className={`flex-1 rounded-md border py-1.5 text-sm font-medium transition-colors ${
                linesPerSlide === n
                  ? "border-[var(--v-accent)] bg-[var(--v-accent-soft)] text-[var(--v-accent)]"
                  : "border-[var(--v-border)] bg-[var(--v-surface-3)] text-[var(--v-text-dim)] hover:text-[var(--v-text)]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Dual language" icon={Languages}>
        <label className="flex items-center justify-between">
          <span className="text-sm">Show a translation line under the lyrics</span>
          <Toggle
            checked={settings?.dualLanguage ?? false}
            onChange={(v) => patchSettings({ dualLanguage: v })}
          />
        </label>
        {settings?.dualLanguage && (
          <label className="mt-3 block">
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--v-text-faint)]">Secondary language</span>
            <select
              value={settings?.secondaryLang ?? ""}
              onChange={(e) => patchSettings({ secondaryLang: e.target.value || null })}
              className="w-full rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)] px-3 py-2 text-sm outline-none focus:border-[var(--v-accent)]"
            >
              <option value="">— none —</option>
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-[var(--v-text-faint)]">
              Add translations per section from the song's <b>Translate</b> panel.
            </span>
          </label>
        )}
      </Group>
    </div>
  );
}

/* ---------------- Bible ---------------- */

const BIBLE_LANG_PACKS: { key: "yor" | "hau" | "ibo"; label: string }[] = [
  { key: "yor", label: "Yoruba" },
  { key: "hau", label: "Hausa" },
  { key: "ibo", label: "Igbo" },
];

function BibleSection({
  settings,
  patchSettings,
  previewTheme,
}: {
  settings: AppSettings | undefined;
  patchSettings: (p: Partial<AppSettings>) => void;
  previewTheme: LiveTheme;
}) {
  const langs = settings?.bibleLangs ?? { yor: true, hau: true, ibo: true };
  const bt = settings?.bibleTheme ?? null;
  const overridesOn = !!bt;

  return (
    <div>
      <PreviewStrip
        theme={previewTheme}
        lines={["For God so loved the world, that he gave his only begotten Son"]}
      />

      <Group title="Bible versions" icon={BookOpen}>
        <p className="mb-3 text-[11px] text-[var(--v-text-faint)]">
          English versions (KJV, WEB, ASV, BBE) are always available. Toggle the extra language packs shown in the Bible tab.
        </p>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm">English (KJV · WEB · ASV · BBE)</span>
            <span className="rounded-md bg-[var(--v-surface-3)] px-2 py-0.5 text-[10px] font-medium uppercase text-[var(--v-text-faint)]">
              Always on
            </span>
          </div>
          {BIBLE_LANG_PACKS.map((p) => (
            <label key={p.key} className="flex items-center justify-between">
              <span className="text-sm">{p.label}</span>
              <Toggle
                checked={langs[p.key] !== false}
                onChange={(v) => patchSettings({ bibleLangs: { ...langs, [p.key]: v } })}
              />
            </label>
          ))}
        </div>
      </Group>

      <Group title="Scripture look" icon={Type}>
        <label className="flex items-center justify-between">
          <span className="text-sm">Override the lyric look for Bible verses</span>
          <Toggle
            checked={overridesOn}
            onChange={(v) => patchSettings({ bibleTheme: v ? { textAlign: "center" } : null })}
          />
        </label>
        <p className="mt-1 text-[11px] text-[var(--v-text-faint)]">
          Off = scripture uses the same theme, background and font as lyrics.
        </p>
        {overridesOn && (
          <div className="mt-4 border-t border-[var(--v-border)] pt-4">
            <OverrideEditor
              value={bt}
              onChange={(next) => patchSettings({ bibleTheme: next })}
              inheritLabel="Same as lyrics"
            />
          </div>
        )}
      </Group>
    </div>
  );
}

/* ---------------- General ---------------- */

function GeneralSection({
  settings,
  patchSettings,
  desktop,
}: {
  settings: AppSettings | undefined;
  patchSettings: (p: Partial<AppSettings>) => void;
  desktop: ReturnType<typeof useDesktop>;
}) {
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  useEffect(() => {
    if (!desktop) return;
    desktop.listDisplays().then(setDisplays).catch(() => {});
  }, [desktop]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div>
      <Group title="Projector output" icon={Monitor}>
        {desktop ? (
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--v-text-faint)]">Output display</span>
            <select
              value={settings?.output.displayId ?? ""}
              onChange={(e) =>
                patchSettings({
                  output: {
                    ...(settings?.output ?? { resolution: "auto" }),
                    displayId: e.target.value ? Number(e.target.value) : null,
                  },
                })
              }
              className="w-full rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)] px-3 py-2 text-sm outline-none focus:border-[var(--v-accent)]"
            >
              <option value="">Auto (second monitor)</option>
              {displays.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} {d.isPrimary ? "(primary)" : ""} · {d.size.width}×{d.size.height}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm text-[var(--v-text-dim)]">
            Running in the browser — the projector opens as a window. The desktop app can send it fullscreen to a second monitor.
          </p>
        )}
        <p className="mt-2 text-[11px] text-[var(--v-text-faint)]">
          Open / close the projector from the panel at the bottom-right of the operator screen.
        </p>
      </Group>

      <Group title="AI auto-follow" icon={Ear}>
        <label className="flex items-center justify-between">
          <span className="text-sm">Advance slides automatically by listening to the room</span>
          <Toggle
            checked={settings?.autoFollow ?? false}
            onChange={(v) => patchSettings({ autoFollow: v })}
          />
        </label>
        <p className="mt-1 text-[11px] text-[var(--v-text-faint)]">
          Requires a speech key on the server. Manual next/prev always overrides.
        </p>
      </Group>

      <Group title="Outputs & companion screens" icon={Monitor}>
        <ul className="space-y-1.5 text-sm">
          {[
            { label: "Stage display (band / confidence monitor)", url: `${origin}/#/stage` },
            { label: "Phone remote", url: `${origin}/#/remote` },
            { label: "Stream overlay (OBS browser source)", url: `${origin}/#/stream` },
          ].map((l) => (
            <li key={l.url} className="flex items-center justify-between gap-3">
              <span className="text-[var(--v-text-dim)]">{l.label}</span>
              <a href={l.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-[var(--v-accent)] hover:underline">
                Open ↗
              </a>
            </li>
          ))}
        </ul>
      </Group>
    </div>
  );
}

/* ---------------- Backgrounds (moved from the operator sidebar) ---------------- */

function BackgroundsEditor({
  activeId,
  onSelect,
}: {
  activeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const media = useMedia();
  const upload = useUploadMedia();
  const addUrl = useAddMediaUrl();
  const del = useDeleteMedia();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [color, setColor] = useState("#0a0a0c");
  const items: MediaItem[] = media.data ?? [];

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        <button
          onClick={() => onSelect(null)}
          className={`relative aspect-video overflow-hidden rounded-md border-2 bg-[var(--v-surface-3)] text-[10px] text-[var(--v-text-faint)] transition-colors ${
            !activeId ? "border-[var(--v-accent)]" : "border-[var(--v-border)] hover:border-[var(--v-text-faint)]"
          }`}
        >
          <span className="grid h-full w-full place-items-center">None</span>
        </button>
        {items.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={`group relative aspect-video overflow-hidden rounded-md border-2 bg-black transition-colors ${
              activeId === m.id ? "border-[var(--v-accent)]" : "border-[var(--v-border)] hover:border-[var(--v-text-faint)]"
            }`}
          >
            {m.type === "color" ? (
              <span className="block h-full w-full" style={{ background: m.url }} />
            ) : m.type === "video" ? (
              <>
                <video src={m.url} muted className="h-full w-full object-cover" />
                <Film className="absolute right-1 top-1 h-3 w-3 text-white/80" />
              </>
            ) : (
              <img src={m.url} alt="" className="h-full w-full object-cover" />
            )}
            <span
              onClick={(e) => {
                e.stopPropagation();
                del.mutate(m.id);
                if (activeId === m.id) onSelect(null);
              }}
              className="absolute left-1 top-1 hidden rounded bg-black/60 p-0.5 text-white group-hover:block"
            >
              <Trash2 className="h-3 w-3" />
            </span>
          </button>
        ))}
        <button
          onClick={() => fileRef.current?.click()}
          className="grid aspect-video place-items-center rounded-md border-2 border-dashed border-[var(--v-border)] text-[var(--v-text-faint)] transition-colors hover:border-[var(--v-accent)] hover:text-[var(--v-accent)]"
          title="Upload image or video"
        >
          {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </button>
      </div>
      {media.isLoading && <p className="mt-2 text-[11px] text-[var(--v-text-faint)]">Loading media…</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload.mutate(f);
          e.target.value = "";
        }}
      />

      <div className="mt-3 flex gap-1.5">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--v-text-faint)]" />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Add image / video by URL"
            className="w-full rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)] py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[var(--v-accent)]"
          />
        </div>
        <button
          disabled={!url.trim() || addUrl.isPending}
          onClick={() => {
            const u = url.trim();
            const type = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u) ? "video" : "image";
            addUrl.mutate({ type, uri: u }, { onSuccess: () => setUrl("") });
          }}
          className="rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)] px-2.5 text-xs hover:bg-[var(--v-surface)] disabled:opacity-40"
        >
          Add
        </button>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-9 cursor-pointer rounded border border-[var(--v-border)] bg-transparent"
          />
          <button
            onClick={() => addUrl.mutate({ type: "color", uri: color })}
            className="rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)] px-2.5 py-1.5 text-xs hover:bg-[var(--v-surface)]"
          >
            Add color
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- tiny toggle ---------------- */

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-[var(--v-accent)]" : "bg-[var(--v-surface-3)]"}`}
      role="switch"
      aria-checked={checked}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "left-4" : "left-0.5"}`} />
    </button>
  );
}
