/**
 * Server-side live state store + SSE fan-out.
 *
 * The projector window shares BroadcastChannel/localStorage with the operator,
 * but an OBS browser-source (or any external stream client) runs in a separate
 * process and cannot. So the operator also POSTs live state to the server, which
 * keeps the latest snapshot and streams every change to connected SSE clients
 * (the /stream route). This is what makes streaming / OBS / NDI-bridge work.
 */

export type ServerLiveState = Record<string, unknown> & { rev?: number };

const IDLE: ServerLiveState = { status: "idle", rev: 0 };

let current: ServerLiveState = IDLE;
const subscribers = new Set<(s: ServerLiveState) => void>();

export function getLiveState(): ServerLiveState {
  return current;
}

export function setLiveState(state: ServerLiveState): ServerLiveState {
  current = state;
  for (const fn of subscribers) {
    try {
      fn(state);
    } catch {
      /* ignore individual subscriber errors */
    }
  }
  return current;
}

export function subscribeLive(fn: (s: ServerLiveState) => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function liveSubscriberCount(): number {
  return subscribers.size;
}
