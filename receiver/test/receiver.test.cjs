"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parseBeacon, normaliseAddress, Discovery } = require("../lib/discovery.cjs");
const { CameraSink, findLoopbackDevice, buildArgs } = require("../lib/camera.cjs");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "vifug-rx-"));
const beacon = (o) => Buffer.from(JSON.stringify({ vifug: 1, name: "Sanctuary PC", port: 4200, v: "1.39.0", ...o }));

test("a beacon becomes a list entry using the sender's address", () => {
  const e = parseBeacon(beacon(), "192.168.1.20", 1000);
  assert.equal(e.origin, "http://192.168.1.20:4200");
  assert.equal(e.name, "Sanctuary PC");
  assert.equal(e.id, "192.168.1.20:4200");
});

test("anything that is not a Vifug beacon is ignored", () => {
  assert.equal(parseBeacon(Buffer.from("hello"), "10.0.0.1"), null);
  assert.equal(parseBeacon(beacon({ vifug: 2 }), "10.0.0.1"), null);
  assert.equal(parseBeacon(beacon({ port: 0 }), "10.0.0.1"), null);
  assert.equal(parseBeacon(beacon({ port: "x" }), "10.0.0.1"), null);
  assert.equal(parseBeacon(beacon(), "not-an-ip"), null);
});

test("a Vifug that stops announcing drops off the list", () => {
  const d = new Discovery();
  const e = parseBeacon(beacon(), "10.0.0.5", 1000);
  d.found.set(e.id, e);
  d.prune(1000 + 3000);
  assert.equal(d.list().length, 1);
  d.prune(1000 + 8000);
  assert.equal(d.list().length, 0);
});

test("typed addresses are tidied into an origin", () => {
  assert.equal(normaliseAddress("192.168.1.20:4200"), "http://192.168.1.20:4200");
  assert.equal(normaliseAddress("http://pc.local:4200/#/x"), "http://pc.local:4200");
  assert.equal(normaliseAddress("  "), null);
  assert.equal(normaliseAddress("http://"), null);
});

test("the loopback camera is found, and one named for Vifug wins", () => {
  const sys = tmp();
  const mk = (n, label) => { fs.mkdirSync(path.join(sys, n)); fs.writeFileSync(path.join(sys, n, "name"), label + "\n"); };
  mk("video0", "Integrated Webcam");
  assert.equal(findLoopbackDevice(sys, "/dev"), null);
  mk("video3", "Dummy video device (0x0000)");
  assert.equal(findLoopbackDevice(sys, "/dev"), path.join("/dev", "video3"));
  mk("video10", "Vifug");
  assert.equal(findLoopbackDevice(sys, "/dev"), path.join("/dev", "video10"));
  assert.equal(findLoopbackDevice(path.join(sys, "nope")), null);
});

test("on Linux with no loopback device the error says how to load one", () => {
  const s = new CameraSink({ inWidth: 64, inHeight: 36, width: 64, height: 36, fps: 10, background: "black", platform: "linux" });
  if (findLoopbackDevice()) return; // a real one exists here; nothing to prove
  assert.throws(() => s.start(), /modprobe v4l2loopback/);
});

function frame(w, h, rgba) {
  const b = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) b.writeUInt32LE(rgba >>> 0, i * 4);
  return b;
}
const pixel = (file, w, x, y) => {
  const raw = fs.readFileSync(file);
  const o = (y * w + x) * 3;
  return [raw[o], raw[o + 1], raw[o + 2]];
};

test("transparent frames come out over the chosen background; opaque ones are unchanged", async () => {
  const out = path.join(tmp(), "out.rgb");
  const W = 64, H = 36;
  const sink = new CameraSink({
    inWidth: 128, inHeight: 72, width: W, height: H, fps: 15, background: "green",
    testOutput: ["-frames:v", "6", "-pix_fmt", "rgb24", "-f", "rawvideo", out],
  }).start();
  // BGRA little-endian words: 0xAARRGGBB. Fully transparent, then opaque red.
  for (let i = 0; i < 3; i++) sink.write(frame(128, 72, 0x00000000));
  for (let i = 0; i < 3; i++) sink.write(frame(128, 72, 0xffff0000));
  sink.stop();
  await new Promise((r) => sink.proc.on("exit", r));
  assert.equal(sink.status().error, null);
  const size = fs.statSync(out).size;
  assert.equal(size % (W * H * 3), 0, "whole frames only");
  assert.ok(size / (W * H * 3) >= 5, "frames written: " + size / (W * H * 3));
  const first = pixel(out, W, 10, 10);
  assert.ok(first[1] > 150 && first[0] < 40, "transparent shows the green backdrop: " + first);
  const raw = fs.readFileSync(out);
  const n = raw.length / (W * H * 3);
  const o = ((n - 1) * W * H + 10 * W + 10) * 3;
  assert.ok(raw[o] > 200 && raw[o + 1] < 40, "opaque red stays red: " + [raw[o], raw[o + 1], raw[o + 2]]);
});

test("the Windows path pipes the converted frames to the helper", async () => {
  const dir = tmp();
  const counted = path.join(dir, "count.txt");
  const helper = path.join(dir, "helper.cjs");
  fs.writeFileSync(helper, `#!${process.execPath}\nlet n=0;process.stdin.on("data",d=>n+=d.length);process.stdin.on("end",()=>require("fs").writeFileSync(${JSON.stringify(counted)},String(n)));`);
  fs.chmodSync(helper, 0o755);
  const W = 32, H = 18;
  const sink = new CameraSink({
    inWidth: W, inHeight: H, width: W, height: H, fps: 15, background: "black",
    testOutput: ["-frames:v", "4", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"], helperPath: helper,
  }).start();
  for (let i = 0; i < 6; i++) sink.write(frame(W, H, 0xff00ff00));
  sink.stop();
  await new Promise((r) => sink.helper.on("exit", r));
  assert.equal(Number(fs.readFileSync(counted, "utf8")) % (W * H * 3), 0);
  assert.ok(Number(fs.readFileSync(counted, "utf8")) >= 3 * W * H * 3);
});

test("the ffmpeg command overlays on a background and scales to the camera size", () => {
  const a = buildArgs({ inWidth: 3840, inHeight: 2160, width: 1920, height: 1080, fps: 30, background: "magenta", output: ["-f", "null", "-"] });
  const f = a[a.indexOf("-filter_complex") + 1];
  assert.match(f, /color=c=0xff00ff:s=1920x1080:r=30/);
  assert.match(f, /scale=1920:1080/);
  assert.ok(a.includes("3840x2160"));
});
