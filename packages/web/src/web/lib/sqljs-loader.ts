import type { SqlJsStatic } from "sql.js";

let cached: Promise<SqlJsStatic> | null = null;

/**
 * SQLite in the browser, loaded on first use.
 *
 * A dynamic import, so the engine (and its ~600 KB of WebAssembly) is only
 * fetched when somebody actually imports an EasyWorship library, not on every
 * page load.
 */
export function loadSqlJs(): Promise<SqlJsStatic> {
  if (!cached) {
    cached = (async () => {
      const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([
        import("sql.js"),
        import("sql.js/dist/sql-wasm.wasm?url"),
      ]);
      return initSqlJs({ locateFile: () => wasmUrl });
    })();
    // A failed load must not be remembered, or a retry would never work.
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}
