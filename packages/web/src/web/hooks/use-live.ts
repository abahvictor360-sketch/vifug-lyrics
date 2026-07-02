import { useEffect, useState } from "react";
import { liveBus, type LiveState } from "../lib/live-bus";

/** Subscribe to the live output state (used by the projector window & preview). */
export function useLiveState(): LiveState {
  const [state, setState] = useState<LiveState>(() => liveBus().snapshot());
  useEffect(() => {
    const bus = liveBus();
    setState(bus.snapshot());
    return bus.subscribe(setState);
  }, []);
  return state;
}
