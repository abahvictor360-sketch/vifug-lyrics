"use strict";
/**
 * Finding Vifugs on the network.
 *
 * The desktop app broadcasts a small UDP packet every couple of seconds (see
 * packages/desktop/electron/beacon.ts). This listens for them and keeps a list
 * of whoever has spoken recently. The address is taken from the packet's
 * sender, not from its contents, so the entry points at the adapter that
 * actually reaches that computer.
 */
const dgram = require("node:dgram");

const BEACON_PORT = 47890;
const STALE_MS = 7000;

/** Turn one packet into a list entry, or null if it is not ours / not sane. */
function parseBeacon(buf, address, now = Date.now()) {
  let m;
  try {
    m = JSON.parse(buf.toString("utf8"));
  } catch {
    return null;
  }
  if (!m || m.vifug !== 1) return null;
  const port = Number(m.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  if (typeof address !== "string" || !/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) return null;
  const name = typeof m.name === "string" && m.name.trim() ? m.name.trim().slice(0, 60) : address;
  return {
    id: `${address}:${port}`,
    name,
    origin: `http://${address}:${port}`,
    version: typeof m.v === "string" ? m.v.slice(0, 20) : "",
    lastSeen: now,
  };
}

class Discovery {
  constructor(onChange) {
    this.onChange = onChange || (() => {});
    this.found = new Map();
    this.socket = null;
    this.sweep = null;
    this.error = null;
  }

  start() {
    this.stop();
    const s = dgram.createSocket({ type: "udp4", reuseAddr: true });
    s.on("error", (e) => {
      // Another receiver on this computer, or a locked-down machine: say so
      // rather than showing an empty list that looks like "no Vifug found".
      this.error = e && e.message ? e.message : String(e);
      this.onChange(this.list());
    });
    s.on("message", (buf, rinfo) => {
      const e = parseBeacon(buf, rinfo.address);
      if (!e) return;
      const isNew = !this.found.has(e.id);
      this.found.set(e.id, e);
      if (isNew) this.onChange(this.list());
    });
    s.bind(BEACON_PORT, () => {
      this.error = null;
    });
    this.socket = s;
    this.sweep = setInterval(() => this.prune(), 2000);
    if (this.sweep.unref) this.sweep.unref();
  }

  prune(now = Date.now()) {
    let changed = false;
    for (const [id, e] of this.found) {
      if (now - e.lastSeen > STALE_MS) {
        this.found.delete(id);
        changed = true;
      }
    }
    if (changed) this.onChange(this.list());
  }

  list() {
    return [...this.found.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  stop() {
    if (this.sweep) clearInterval(this.sweep);
    this.sweep = null;
    try {
      if (this.socket) this.socket.close();
    } catch {
      /* already closed */
    }
    this.socket = null;
  }
}

/** "192.168.1.20:4200", "http://pc:4200/" or "pc" -> a clean http origin, or null. */
function normaliseAddress(input) {
  let t = String(input || "").trim();
  if (!t) return null;
  if (!/^https?:\/\//i.test(t)) t = `http://${t}`;
  try {
    const u = new URL(t);
    if (!u.hostname) return null;
    return u.origin;
  } catch {
    return null;
  }
}

module.exports = { Discovery, parseBeacon, normaliseAddress, BEACON_PORT, STALE_MS };
