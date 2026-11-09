import { useState } from "react";

/**
 * "Put this on that screen": one row per extra output screen, with Send and
 * Clear. Shared by the Media inspector and the Presentations panel so the two
 * look and behave the same, and so "which screen did that go to" has one answer.
 *
 * The main screen is deliberately not listed: Go live already is the main
 * screen, and a second way to reach it would only invite doing both.
 */
export function SendToScreen({
  screens,
  what,
  onSend,
  onClear,
  disabled = false,
  emptyHint,
}: {
  screens: { id: string; name: string }[];
  /** What is being sent, for the buttons' screen-reader names: "slide 3", "this video". */
  what: string;
  onSend: (screenId: string) => void;
  onClear?: (screenId: string) => void;
  /** Nothing to send yet (no slide picked). */
  disabled?: boolean;
  /** Shown when there are no extra screens. */
  emptyHint?: string;
}) {
  /** The screen it was last sent to from here, to say so on the row. */
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (screens.length === 0) {
    return emptyHint ? <p className="text-[12px] text-[var(--v-text-faint)]">{emptyHint}</p> : null;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {screens.map((sc) => (
        <li
          key={sc.id}
          className="flex items-center gap-1.5 rounded-md border border-[var(--v-border)] bg-[var(--v-surface-3)] py-1 pl-2.5 pr-1"
        >
          <span className="min-w-0 flex-1 truncate text-[12px]" title={sc.name}>
            {sc.name}
            {sentTo === sc.id && <span className="ml-1.5 text-[var(--v-accent)]">&#10003; sent</span>}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onSend(sc.id);
              setSentTo(sc.id);
            }}
            aria-label={`Send ${what} to ${sc.name}`}
            className="rounded bg-[var(--v-accent-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--v-accent)] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v-accent)] disabled:opacity-40"
          >
            Send
          </button>
          <button
            type="button"
            onClick={() => {
              onClear?.(sc.id);
              if (sentTo === sc.id) setSentTo(null);
            }}
            aria-label={`Clear ${sc.name}`}
            className="rounded px-2 py-1 text-[11px] text-[var(--v-text-faint)] hover:text-[var(--v-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v-accent)]"
          >
            Clear
          </button>
        </li>
      ))}
    </ul>
  );
}
