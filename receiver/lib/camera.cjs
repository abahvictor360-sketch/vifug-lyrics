"use strict";
/**
 * The camera output: raw frames in, a system video-capture device out.
 *
 * Frames arrive from the receiver's hidden page as BGRA (with transparency).
 * ffmpeg does the rest in one place for both systems - lay the picture over a
 * solid background (a camera has no transparency, so this is where "optional
 * transparency" ends up: the backdrop is a colour the other program can key
 * out, or plain black), scale it to the chosen size, and convert it.
 *
 *   Linux    ffmpeg writes straight into a v4l2loopback device.
 *   Windows  ffmpeg writes raw RGB to a small helper (helper/vcam_bridge.py,
 *            shipped as vcam-bridge.exe) which hands it to the installed
 *            virtual-camera driver.
 *
 * Nothing here touches Electron, so it can be exercised from plain Node.
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const BACKGROUNDS = {
  black: "0x000000",
  green: "0x00b140",
  magenta: "0xff00ff",
  blue: "0x0047bb",
  white: "0xffffff",
};

function ffmpegPath() {
  try {
    // Bundled by the ffmpeg-static dependency when the app is packaged.
    // In a packaged app the binary is unpacked beside the archive, and a path
    // inside app.asar cannot be executed.
    const p = String(require("ffmpeg-static")).replace("app.asar", "app.asar.unpacked");
    if (p && fs.existsSync(p)) return p;
  } catch {
    /* fall through to the system copy */
  }
  return process.env.VIFUG_FFMPEG || "ffmpeg";
}

/**
 * Find a v4l2loopback device. `sysRoot` is /sys/class/video4linux, a parameter
 * so a test can point it at a folder it made. Prefers one named for Vifug.
 */
function findLoopbackDevice(sysRoot = "/sys/class/video4linux", devRoot = "/dev") {
  let names;
  try {
    names = fs.readdirSync(sysRoot).filter((n) => /^video\d+$/.test(n));
  } catch {
    return null;
  }
  const found = [];
  for (const n of names) {
    let label = "";
    try {
      label = fs.readFileSync(path.join(sysRoot, n, "name"), "utf8").trim();
    } catch {
      /* unreadable entry */
    }
    // Real webcams are not loopback devices. The module names its devices
    // "Dummy video device" unless card_label is given.
    if (/vifug|loopback|dummy video device|v4l2loopback/i.test(label)) found.push({ n, label });
  }
  if (!found.length) return null;
  found.sort((a, b) => Number(/vifug/i.test(b.label)) - Number(/vifug/i.test(a.label)));
  return path.join(devRoot, found[0].n);
}

const LINUX_HELP =
  "No virtual camera device was found. Load the v4l2loopback module once (it needs administrator rights):\n" +
  '  sudo modprobe v4l2loopback devices=1 video_nr=10 card_label="Vifug" exclusive_caps=1\n' +
  "Install it first if the command is missing (package v4l2loopback-dkms). Then start the camera again.";

/** The ffmpeg arguments that take BGRA frames and produce what the output needs. */
function buildArgs({ inWidth, inHeight, width, height, fps, background, output }) {
  const bg = BACKGROUNDS[background] || BACKGROUNDS.black;
  const filter =
    `color=c=${bg}:s=${width}x${height}:r=${fps}[bg];` +
    `[0:v]scale=${width}:${height}:flags=bilinear,format=bgra[fg];` +
    `[bg][fg]overlay=shortest=1:format=auto`;
  return [
    "-hide_banner", "-loglevel", "error",
    "-f", "rawvideo", "-pix_fmt", "bgra", "-s", `${inWidth}x${inHeight}`, "-framerate", String(fps), "-i", "pipe:0",
    "-filter_complex", filter,
    ...output,
  ];
}

class CameraSink {
  /**
   * @param {object} o
   * @param {number} o.inWidth/inHeight  size of the frames being written
   * @param {number} o.width/height      size the camera presents
   * @param {number} o.fps
   * @param {string} o.background        key of BACKGROUNDS
   * @param {string} [o.platform]        process.platform; a parameter for tests
   * @param {string[]} [o.testOutput]    ffmpeg output args that replace the device (tests)
   * @param {string} [o.helperPath]      Windows bridge executable (and tests)
   * @param {string[]} [o.helperArgs]
   */
  constructor(o) {
    this.o = o;
    this.proc = null;
    this.helper = null;
    this.frames = 0;
    this.dropped = 0;
    this.error = null;
    this.busy = false;
    this.onExit = null;
  }

  start() {
    const { width, height, fps } = this.o;
    const platform = this.o.platform || process.platform;
    let output;

    if (this.o.testOutput) {
      output = this.o.testOutput;
    } else if (platform === "linux") {
      const dev = findLoopbackDevice();
      if (!dev) throw new Error(LINUX_HELP);
      output = ["-pix_fmt", "yuyv422", "-f", "v4l2", dev];
    } else if (platform === "win32") {
      output = ["-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"];
    } else {
      throw new Error("The camera output is not available on this system yet. The full-screen view still works.");
    }

    const args = buildArgs({ ...this.o, output });
    const useHelper = (!this.o.testOutput && platform === "win32") || !!(this.o.testOutput && this.o.helperPath);
    this.proc = spawn(ffmpegPath(), args, { stdio: ["pipe", useHelper ? "pipe" : "ignore", "pipe"] });

    let err = "";
    this.proc.stderr.on("data", (d) => {
      err = (err + d.toString()).slice(-2000);
    });
    this.proc.stdin.on("error", () => {});
    this.proc.on("error", (e) => {
      this.error = e.code === "ENOENT" ? "ffmpeg was not found." : e.message;
    });
    this.proc.on("exit", (code) => {
      if (this.proc && code && !this.stopping) this.error = err.trim() || `ffmpeg stopped (${code}).`;
      if (this.onExit) this.onExit(this.error);
    });
    this.proc.stdin.on("drain", () => {
      this.busy = false;
    });

    if (useHelper) {
      const helper = this.o.helperPath;
      if (!helper) throw new Error("The camera helper is missing from this install.");
      this.helper = spawn(helper, [...(this.o.helperArgs || []), "--width", String(width), "--height", String(height), "--fps", String(fps)], {
        stdio: ["pipe", "ignore", "pipe"],
      });
      let herr = "";
      this.helper.stderr.on("data", (d) => {
        herr = (herr + d.toString()).slice(-2000);
      });
      this.helper.stdin.on("error", () => {});
      this.helper.on("error", (e) => {
        this.error = `The camera helper could not start: ${e.message}`;
      });
      this.helper.on("exit", (code) => {
        if (code && !this.stopping) this.error = herr.trim() || `The camera helper stopped (${code}).`;
        if (this.onExit) this.onExit(this.error);
      });
      this.proc.stdout.pipe(this.helper.stdin);
    }
    return this;
  }

  /** Write one BGRA frame. Drops it, rather than queueing, when ffmpeg is behind. */
  write(buf) {
    if (!this.proc || this.stopping || this.error) return false;
    if (this.busy) {
      this.dropped++;
      return false;
    }
    const ok = this.proc.stdin.write(buf);
    if (!ok) this.busy = true;
    this.frames++;
    return true;
  }

  stop() {
    this.stopping = true;
    // Only ffmpeg's input is closed here. The helper's input is ffmpeg's
    // output, so it ends by itself once the last frame has gone through;
    // closing it too would throw away whatever is still in the pipe.
    try { if (this.proc) this.proc.stdin.end(); } catch { /* closed */ }
    const later = (p) => {
      if (!p) return;
      setTimeout(() => { try { p.kill(); } catch { /* gone */ } }, 1500).unref();
    };
    later(this.proc);
    later(this.helper);
  }

  status() {
    return { running: !!this.proc && !this.stopping && !this.error, frames: this.frames, dropped: this.dropped, error: this.error };
  }
}

module.exports = { CameraSink, buildArgs, findLoopbackDevice, ffmpegPath, BACKGROUNDS, LINUX_HELP };
