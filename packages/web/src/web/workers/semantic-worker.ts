/// <reference lib="webworker" />
/**
 * The meaning-matching model, off the main thread.
 *
 * Embeds every verse of the chosen Bible once (a few minutes the first time,
 * then read back from IndexedDB), then answers "which verses mean this?" for a
 * sentence in a few milliseconds. The model (~23 MB) comes from the Hugging
 * Face CDN the first time and from the browser cache after.
 */
import { pipeline, env } from "@huggingface/transformers";
import { quantise, topK, SEMANTIC_DIM, SEMANTIC_MODEL } from "../lib/semantic-verse";

env.allowLocalModels = false;
try {
  env.backends.onnx.wasm!.numThreads = 1;
} catch {
  /* older runtime: single-threaded already */
}

export type SemanticIn =
  | { type: "build"; versionId: string; texts: string[] }
  | { type: "query"; id: number; text: string; k: number };
export type SemanticOut =
  | { type: "progress"; done: number; total: number }
  | { type: "ready"; cached: boolean }
  | { type: "error"; message: string }
  | { type: "result"; id: number; hits: [number, number][] };

type Extractor = (t: string | string[], o: Record<string, unknown>) => Promise<{ data: Float32Array }>;
let extractor: Extractor | null = null;
let matrix: Int8Array | null = null;
let generation = 0;

const say = (m: SemanticOut) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("vifug-semantic", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("vectors");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function readCache(key: string): Promise<Int8Array | null> {
  try {
    const db = await idb();
    return await new Promise((resolve) => {
      const g = db.transaction("vectors").objectStore("vectors").get(key);
      g.onsuccess = () => resolve(g.result ? new Int8Array(g.result as ArrayBuffer) : null);
      g.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
async function writeCache(key: string, m: Int8Array) {
  try {
    const db = await idb();
    db.transaction("vectors", "readwrite").objectStore("vectors").put(m.buffer.slice(0), key);
  } catch {
    /* no cache: it is rebuilt next time */
  }
}

async function load(): Promise<Extractor> {
  if (!extractor) {
    extractor = (await pipeline("feature-extraction", SEMANTIC_MODEL, { dtype: "q8" })) as unknown as Extractor;
  }
  return extractor;
}

async function build(versionId: string, texts: string[]) {
  const mine = ++generation;
  matrix = null;
  try {
    const key = `v1:${SEMANTIC_MODEL}:${versionId}:${texts.length}`;
    const cached = await readCache(key);
    if (cached && cached.length === texts.length * SEMANTIC_DIM) {
      await load();
      if (mine !== generation) return;
      matrix = cached;
      say({ type: "ready", cached: true });
      return;
    }
    const ex = await load();
    const out = new Int8Array(texts.length * SEMANTIC_DIM);
    const BATCH = 32;
    for (let i = 0; i < texts.length; i += BATCH) {
      if (mine !== generation) return;
      const batch = texts.slice(i, i + BATCH);
      const t = await ex(batch, { pooling: "mean", normalize: true });
      out.set(quantise(t.data), i * SEMANTIC_DIM);
      say({ type: "progress", done: Math.min(texts.length, i + BATCH), total: texts.length });
    }
    matrix = out;
    void writeCache(key, out);
    say({ type: "ready", cached: false });
  } catch (e) {
    say({ type: "error", message: e instanceof Error ? e.message : String(e) });
  }
}

self.onmessage = async (ev: MessageEvent<SemanticIn>) => {
  const m = ev.data;
  if (m.type === "build") return void build(m.versionId, m.texts);
  if (!matrix || !extractor) return say({ type: "result", id: m.id, hits: [] });
  const t = await extractor(m.text, { pooling: "mean", normalize: true });
  say({ type: "result", id: m.id, hits: topK(t.data, matrix, m.k) });
};
