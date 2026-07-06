import { Link } from "wouter";
import {
  Music4, BookOpen, Ear, Film, Monitor, MonitorSmartphone, Smartphone,
  Radio, Languages, ArrowRight, Sparkles, Wifi, ListChecks,
} from "lucide-react";
import { useDesktop } from "../hooks/use-desktop";

/**
 * Public landing page (route "/"). The operator console lives at "/console".
 * This is the marketing / entry screen a web visitor lands on; the big CTA
 * launches the console, and companion-screen links open the satellite views.
 */

const FEATURES: { icon: typeof Music4; title: string; body: string }[] = [
  {
    icon: Music4,
    title: "Lyrics & arrangements",
    body: "A 325-song library out of the box. Reorder sections, repeat choruses, and drive slides with a ProPresenter-style preview → live stage.",
  },
  {
    icon: BookOpen,
    title: "Offline Bible, 7 versions",
    body: "KJV, WEB, ASV & BBE plus Yoruba, Hausa and Igbo — fully offline. Jump by reference or search the whole version instantly.",
  },
  {
    icon: Ear,
    title: "AI auto-follow",
    body: "Listens to the room and advances slides automatically, in the language your congregation sings — with manual override always winning.",
  },
  {
    icon: Film,
    title: "Native NDI output",
    body: "Publish the projector as a real NDI source on your network — vMix, OBS, TriCaster and Resolume see it live, no capture card needed.",
  },
  {
    icon: Monitor,
    title: "Multi-screen projector",
    body: "Send full-screen lyrics or scripture to a second monitor, with per-Bible theme overrides, backgrounds and lower-thirds.",
  },
  {
    icon: Languages,
    title: "Dual language",
    body: "Show a translation line under every lyric, and manage per-section translations for bilingual services.",
  },
];

const COMPANIONS: { icon: typeof Monitor; label: string; desc: string; href: string }[] = [
  { icon: MonitorSmartphone, label: "Stage display", desc: "Band / confidence monitor", href: "/#/stage" },
  { icon: Smartphone, label: "Phone remote", desc: "Advance from your pocket", href: "/#/remote" },
  { icon: Radio, label: "Stream overlay", desc: "OBS browser source", href: "/#/stream" },
];

export default function LandingPage() {
  const desktop = useDesktop();

  return (
    <div className="min-h-screen bg-[var(--v-bg)] text-[var(--v-text)]">
      {/* ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-70"
        style={{
          background:
            "radial-gradient(60rem 40rem at 50% -10%, var(--v-accent-soft), transparent 70%)",
        }}
      />

      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[var(--v-accent)] to-[var(--v-accent-2)] text-black shadow-[0_2px_12px_var(--v-accent-glow)]">
            <Music4 className="h-4.5 w-4.5" />
          </div>
          <span className="font-display text-base font-bold tracking-tight">Vifug Lyrics</span>
        </div>
        <Link
          href="/console"
          className="rounded-lg border border-[var(--v-border)] bg-[var(--v-surface)] px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--v-accent)] hover:text-[var(--v-accent)]"
        >
          Open console
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-16 pb-20 text-center sm:pt-24">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--v-border)] bg-[var(--v-surface)] px-3 py-1 text-xs font-medium text-[var(--v-text-dim)]">
          <Sparkles className="h-3.5 w-3.5 text-[var(--v-accent)]" />
          Worship presentation, reimagined
        </span>
        <h1 className="mt-6 font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          Lyrics, scripture & live output —
          <span className="bg-gradient-to-r from-[var(--v-accent)] to-[var(--v-accent-2)] bg-clip-text text-transparent">
            {" "}all in sync
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-[var(--v-text-dim)] sm:text-lg">
          Run your service from one console: song lyrics, an offline Bible in seven versions,
          AI auto-follow, and native NDI output to every screen in the building.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/console"
            className="group inline-flex items-center gap-2 rounded-xl bg-[var(--v-accent)] px-6 py-3.5 text-base font-bold text-black shadow-[0_4px_24px_var(--v-accent-glow)] transition-transform hover:-translate-y-0.5"
          >
            Launch console
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="/#/stream"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--v-border)] bg-[var(--v-surface)] px-6 py-3.5 text-base font-medium transition-colors hover:border-[var(--v-accent)]"
          >
            <Radio className="h-5 w-5 text-[var(--v-accent)]" /> Stream overlay
          </a>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[var(--v-text-faint)]">
          <Wifi className="h-3.5 w-3.5" />
          {desktop ? "Running as the desktop app — works fully offline." : "Runs in the browser or as an offline desktop app."}
        </p>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-2xl border border-[var(--v-border)] bg-[var(--v-surface)] p-5 transition-colors hover:border-[var(--v-accent)]/50"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--v-accent-soft)] text-[var(--v-accent)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--v-text-dim)]">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Companion screens */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-2xl border border-[var(--v-border)] bg-[var(--v-surface)] p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-[var(--v-accent)]" />
            <h2 className="font-display text-xl font-semibold">Companion screens</h2>
          </div>
          <p className="mt-1.5 text-sm text-[var(--v-text-dim)]">
            Every output stays in sync with the console — open them on any device on the network.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {COMPANIONS.map((c) => {
              const Icon = c.icon;
              return (
                <a
                  key={c.href}
                  href={c.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-3 rounded-xl border border-[var(--v-border)] bg-[var(--v-surface-2)] p-4 transition-colors hover:border-[var(--v-accent)]"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--v-surface-3)] text-[var(--v-accent)]">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-sm font-medium">
                      {c.label}
                      <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <div className="truncate text-xs text-[var(--v-text-faint)]">{c.desc}</div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA footer */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-[var(--v-border)] bg-gradient-to-br from-[var(--v-surface)] to-[var(--v-surface-2)] px-6 py-12 text-center">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Ready for Sunday?</h2>
          <p className="max-w-xl text-sm text-[var(--v-text-dim)]">
            Open the console, pick a song or a passage, and send it live. No setup, no internet required.
          </p>
          <Link
            href="/console"
            className="group inline-flex items-center gap-2 rounded-xl bg-[var(--v-accent)] px-6 py-3.5 text-base font-bold text-black shadow-[0_4px_24px_var(--v-accent-glow)] transition-transform hover:-translate-y-0.5"
          >
            Launch console
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <p className="mt-8 text-center text-xs text-[var(--v-text-faint)]">
          © {new Date().getFullYear()} Vifug Lyrics · Built for the local church
        </p>
      </section>
    </div>
  );
}
