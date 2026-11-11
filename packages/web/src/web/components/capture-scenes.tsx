import { useState } from "react";
import { Plus, X, LayoutTemplate } from "lucide-react";
import type { LiveCapture } from "../lib/live-bus";

/**
 * Scenes: a capture set-up saved under a name and brought back with one click.
 *
 * A scene is the whole look - which camera or screen, the layout, the video
 * shape, the name bar, the reference position - so "Interview", "Wide shot"
 * and "Scripture beside the speaker" are each one button instead of a dozen
 * settings changed in a hurry. Recalling one cues it to Preview, or changes
 * the picture straight away when a capture is already on air - the same rule
 * every other control in this panel follows.
 *
 * Kept on this device: a scene names a camera by this computer's id for it,
 * which means nothing on another machine.
 */

type Scene = { id: string; name: string; capture: NonNullable<LiveCapture> };

const KEY = "vifug:capture-scenes";

function load(): Scene[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function CaptureScenes({
  current,
  onRecall,
}: {
  current: LiveCapture;
  onRecall: (capture: NonNullable<LiveCapture>) => void;
}) {
  const [scenes, setScenes] = useState<Scene[]>(load);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const save = (next: Scene[]) => {
    setScenes(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private window: scenes last until the page closes */
    }
  };
  const add = () => {
    const n = name.trim();
    if (!n || !current) return;
    const id = `${Date.now()}`;
    save([...scenes, { id, name: n, capture: current }]);
    setActiveId(id);
    setName("");
    setNaming(false);
  };

  if (!scenes.length && !current) return null;

  return (
    <div className="w-full max-w-sm rounded-lg border border-[var(--v-border)] bg-[var(--v-surface-2)] p-3 text-left">
      <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--v-text-faint)]">
        <LayoutTemplate className="h-3.5 w-3.5" /> Scenes
      </p>
      {scenes.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {scenes.map((sc) => (
            <span
              key={sc.id}
              className={`group inline-flex items-center rounded-md border text-[12px] ${
                activeId === sc.id
                  ? "border-[var(--v-accent)] bg-[var(--v-accent-soft)] text-[var(--v-accent)]"
                  : "border-[var(--v-border)] bg-[var(--v-surface-3)]"
              }`}
            >
              <button
                type="button"
                title={`Recall "${sc.name}" (${sc.capture.name})`}
                onClick={() => {
                  onRecall(sc.capture);
                  setActiveId(sc.id);
                }}
                className="max-w-[160px] truncate px-2.5 py-1.5"
              >
                {sc.name}
              </button>
              <button
                type="button"
                aria-label={`Delete scene ${sc.name}`}
                title="Delete scene"
                onClick={() => save(scenes.filter((x) => x.id !== sc.id))}
                className="pr-1.5 text-[var(--v-text-faint)] hover:text-[var(--v-live)]"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-[var(--v-text-faint)]">
          Save this set-up - source, layout, shape and name bar - and bring it back with one click.
        </p>
      )}
      {current &&
        (naming ? (
          <div className="mt-2 flex gap-1.5">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
                if (e.key === "Escape") setNaming(false);
              }}
              placeholder="Scene name (e.g. Interview)"
              className="min-w-0 flex-1 rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)] px-2 py-1.5 text-xs outline-none focus:border-[var(--v-accent)]"
            />
            <button type="button" onClick={add} disabled={!name.trim()} className="rounded-md border border-[var(--v-accent)] px-2.5 text-xs text-[var(--v-accent)] disabled:opacity-40">
              Save
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="mt-2 inline-flex items-center gap-1 text-[12px] text-[var(--v-accent)] hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Save current set-up as a scene
          </button>
        ))}
      {scenes.some((sc) => sc.capture.kind !== "camera") && (
        <p className="mt-2 text-[11px] text-[var(--v-text-faint)]">
          A scene that uses a screen or window may need its source picked again after the app restarts. Cameras and capture cards are remembered.
        </p>
      )}
    </div>
  );
}
