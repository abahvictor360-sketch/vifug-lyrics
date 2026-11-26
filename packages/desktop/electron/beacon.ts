/**
 * Announcing this Vifug on the local network, so the Vifug Receiver on another
 * computer can offer it in a list instead of asking someone to type an address.
 *
 * A UDP broadcast every couple of seconds: nothing to install, nothing to
 * configure, and no extra dependency. It says only who and where - the
 * computer's name, the port the embedded server listens on and the version. It
 * carries no content and nothing that lets a stranger control anything; the
 * pages it points at are the same ones already reachable on the network.
 *
 * The receiver takes the sender's address from the packet itself rather than
 * from the message, so a machine with several adapters is found on the one that
 * actually reaches it.
 */
import dgram from "node:dgram";
import os from "node:os";

/** Receiver and sender agree on this; keep in step with receiver/lib/discovery.cjs. */
export const BEACON_PORT = 47890;
const INTERVAL_MS = 2000;

/** The broadcast address of an IPv4 address on a netmask, or null if either is not IPv4. */
export function broadcastAddress(ip: string, mask: string): string | null {
  const a = ip.split(".").map(Number);
  const m = mask.split(".").map(Number);
  if (a.length !== 4 || m.length !== 4 || [...a, ...m].some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return a.map((o, i) => (o | (~m[i] & 255)) & 255).join(".");
}

/** Where to send: every physical-looking IPv4 subnet's broadcast, plus the limited broadcast. */
export function beaconTargets(ifaces: ReturnType<typeof os.networkInterfaces> = os.networkInterfaces()): string[] {
  const out = new Set<string>(["255.255.255.255"]);
  for (const list of Object.values(ifaces)) {
    for (const i of list ?? []) {
      if (i.family !== "IPv4" || i.internal) continue;
      const b = broadcastAddress(i.address, i.netmask);
      if (b) out.add(b);
    }
  }
  return [...out];
}

let socket: dgram.Socket | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

export function startBeacon(port: number, version: string): void {
  stopBeacon();
  try {
    const s = dgram.createSocket({ type: "udp4", reuseAddr: true });
    s.on("error", () => {
      /* A network with no broadcast path is a normal case, not a fault. */
    });
    s.bind(0, () => {
      try {
        s.setBroadcast(true);
      } catch {
        return;
      }
      const send = () => {
        const msg = Buffer.from(JSON.stringify({ vifug: 1, name: os.hostname(), port, v: version }));
        for (const t of beaconTargets()) s.send(msg, BEACON_PORT, t, () => {});
      };
      send();
      timer = setInterval(send, INTERVAL_MS);
      timer.unref?.();
    });
    socket = s;
  } catch {
    socket = null;
  }
}

export function stopBeacon(): void {
  if (timer) clearInterval(timer);
  timer = null;
  try {
    socket?.close();
  } catch {
    /* already closed */
  }
  socket = null;
}
