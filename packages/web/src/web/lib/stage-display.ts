/**
 * Stage-display publishing (operator -> worship team screen).
 *
 * The operator mirrors the CURRENT live slide, the NEXT-up slide and any
 * service notes to the server, which fans it out over SSE to /#/stage. Runs on
 * a separate device on the LAN so it can't use BroadcastChannel.
 */
import type { StageSlide } from "./stage";

export type StageDisplayPayload = {
  status: "idle" | "live" | "blank" | "clear";
  current: {
    lines: string[];
    caption: string;
    title: string;
    index: number;
    count: number;
  } | null;
  next: { lines: string[]; caption: string } | null;
  notes: string;
  mode: "lyrics" | "bible";
  rev: number;
};

let rev = 0;

function slideToBrief(s: StageSlide | null) {
  if (!s) return null;
  return {
    lines: s.sourceLines,
    caption: s.caption,
    title: s.title,
    index: s.slideIndex,
    count: s.slideCount,
  };
}

export function publishStageDisplay(input: {
  status: StageDisplayPayload["status"];
  current: StageSlide | null;
  next: StageSlide | null;
  notes: string;
  mode: "lyrics" | "bible";
}): void {
  rev += 1;
  const payload: StageDisplayPayload = {
    status: input.status,
    current: slideToBrief(input.current),
    next: input.next
      ? { lines: input.next.sourceLines, caption: input.next.caption }
      : null,
    notes: input.notes,
    mode: input.mode,
    rev,
  };
  try {
    fetch("/api/stage/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
