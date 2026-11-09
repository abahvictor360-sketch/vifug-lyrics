import { useCallback, useEffect, useRef, useState } from "react";
import type { VerseCorpus } from "../lib/quoted-verse";
import type { SemanticIn, SemanticOut } from "../workers/semantic-worker";

export type SemanticStatus = "off" | "building" | "ready" | "error";

/**
 * Runs the meaning model for the current Bible. `query` resolves to
 * [verse index, cosine] pairs, or [] when the model is not ready - the word
 * matcher carries on alone in that case.
 */
export function useSemanticIndex(corpus: VerseCorpus | null, enabled: boolean) {
  const [status, setStatus] = useState<SemanticStatus>("off");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const readyRef = useRef(false);
  const pending = useRef(new Map<number, (h: [number, number][]) => void>());
  const nextId = useRef(1);

  useEffect(() => {
    readyRef.current = false;
    if (!enabled || !corpus) {
      setStatus("off");
      setProgress(0);
      return;
    }
    let w: Worker;
    try {
      w = new Worker(new URL("../workers/semantic-worker.ts", import.meta.url), { type: "module" });
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Workers are not available");
      return;
    }
    worker.current = w;
    setStatus("building");
    setProgress(0);
    setError(null);
    w.onmessage = (ev: MessageEvent<SemanticOut>) => {
      const m = ev.data;
      if (m.type === "progress") setProgress(m.done / m.total);
      else if (m.type === "ready") {
        readyRef.current = true;
        setProgress(1);
        setStatus("ready");
      } else if (m.type === "error") {
        setStatus("error");
        setError(m.message);
      } else {
        pending.current.get(m.id)?.(m.hits);
        pending.current.delete(m.id);
      }
    };
    const texts = corpus.text.map((t) => t.trim());
    w.postMessage({ type: "build", versionId: corpus.versionId, texts } satisfies SemanticIn);
    return () => {
      w.terminate();
      worker.current = null;
      readyRef.current = false;
      for (const r of pending.current.values()) r([]);
      pending.current.clear();
    };
  }, [corpus, enabled]);

  const query = useCallback((text: string, k = 8): Promise<[number, number][]> => {
    const w = worker.current;
    if (!w || !readyRef.current) return Promise.resolve([]);
    return new Promise((resolve) => {
      const id = nextId.current++;
      pending.current.set(id, resolve);
      w.postMessage({ type: "query", id, text, k } satisfies SemanticIn);
    });
  }, []);

  return { status, progress, error, query };
}
