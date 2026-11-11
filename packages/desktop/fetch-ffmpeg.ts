/**
 * Put ffmpeg where electron-builder will bundle it (build/ffmpeg -> the
 * installed app's resources/ffmpeg), for live streaming (electron/stream.ts).
 *
 * The binary is the static build published by the ffmpeg-static project, one
 * file per platform. It is fetched at build time rather than committed: it is
 * ~70 MB, differs per platform, and is only ever needed inside an installer.
 *
 * Best effort. A build machine with no network still produces an installer;
 * streaming then falls back to an ffmpeg on the user's PATH and says so in
 * Settings when there is none.
 *
 * Licence: these builds include GPL components. ffmpeg is shipped as a
 * separate program beside Vifug and run as one, not linked into it; its
 * source is at https://ffmpeg.org and the build recipe at
 * https://github.com/eugeneware/ffmpeg-static.
 */
import { existsSync, mkdirSync, writeFileSync, chmodSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

const RELEASE = "b6.0";
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "build", "ffmpeg");
const exe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
const out = path.join(dir, exe);
const asset = `ffmpeg-${process.platform}-${process.arch}.gz`;
const url = `https://github.com/eugeneware/ffmpeg-static/releases/download/${RELEASE}/${asset}`;

if (existsSync(out) && statSync(out).size > 10_000_000) {
  console.log(`ffmpeg already present: ${out}`);
} else {
  try {
    console.log(`Fetching ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bin = gunzipSync(Buffer.from(await res.arrayBuffer()));
    if (bin.length < 10_000_000) throw new Error(`unexpectedly small (${bin.length} bytes)`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(out, bin);
    if (process.platform !== "win32") chmodSync(out, 0o755);
    console.log(`ffmpeg ready: ${out} (${Math.round(bin.length / 1e6)} MB)`);
  } catch (e) {
    console.warn(
      `::warning::Could not fetch ffmpeg (${e instanceof Error ? e.message : e}) - this build ships WITHOUT built-in live streaming`,
    );
  }
}
