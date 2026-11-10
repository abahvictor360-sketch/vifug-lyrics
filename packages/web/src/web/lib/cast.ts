/**
 * Phone camera and screen cast, peer to peer.
 *
 * A phone (or another computer) opens the /cast page and sends its camera or
 * screen; every Vifug screen that wants the picture - the operator's preview,
 * the projector, the stream page - connects to it separately, so each one gets
 * the video itself rather than a copy relayed through the operator's window.
 * The video travels over WebRTC straight between the devices (same Wi-Fi, no
 * server in the middle). Only the handshake goes through the API; see
 * api/lib/cast-store.ts for why every message there has a single writer.
 *
 * The roles:
 *   viewer  - a Vifug screen. Announces itself ("hello:<id>"), is offered the
 *             picture, answers.
 *   sender  - the phone. Watches for viewers, makes one connection per viewer.
 */

export const CAST_PREFIX = "cast:";
export const isCastSource = (id: string) => id.startsWith(CAST_PREFIX);
export const castRoomOf = (id: string) => id.slice(CAST_PREFIX.length);

/** A random, unguessable room code (the only thing protecting a feed). */
export function newRoomCode(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return [...a].map((n) => (n % 36).toString(36)).join("");
}

const rid = () => {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return [...a].map((n) => (n % 36).toString(36)).join("");
};

/**
 * Where the handshake lives. A phone camera needs a secure (https) page, which
 * a desktop app on the local network is not, so pairing is hosted: the phone
 * opens the https page and both ends use the same hosted API. The video still
 * flows directly between the devices.
 */
export const HOSTED_ORIGIN = "https://app.vifug.com";
export function castOrigin(): string {
  if (typeof window === "undefined") return HOSTED_ORIGIN;
  // A church running its own Vifug server can point pairing at it.
  try {
    const own = window.localStorage.getItem("vifug:cast-origin");
    if (own) return own.replace(/\/$/, "");
  } catch {
    /* storage blocked: use the default */
  }
  const { protocol, hostname, origin } = window.location;
  const secureHost = protocol === "https:" && hostname !== "localhost" && hostname !== "127.0.0.1";
  return secureHost ? origin : HOSTED_ORIGIN;
}
/** The link a phone opens (or scans) to send its picture to `room`. */
export const castPageUrl = (room: string) => `${castOrigin()}/#/cast?room=${room}`;

const RTC: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
};

type Msg = { t: "offer" | "answer"; sdp: string } | { t: "ice"; c: RTCIceCandidateInit };

/** The signalling transport, injectable so the handshake can be tested without a network. */
export type Signal = {
  put(room: string, key: string, payload: unknown): Promise<void>;
  get(room: string, key: string): Promise<{ payload: unknown; at: number; now: number } | null>;
  list(room: string, prefix: string): Promise<{ entries: { key: string; at: number; payload: unknown }[]; now: number } | null>;
};

export const httpSignal: Signal = {
  async put(room, key, payload) {
    await fetch(`${castOrigin()}/api/cast/${room}/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  },
  async get(room, key) {
    try {
      const r = await fetch(`${castOrigin()}/api/cast/${room}/${key}`);
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  },
  async list(room, prefix) {
    try {
      const r = await fetch(`${castOrigin()}/api/cast/${room}/list/${prefix}`);
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  },
};

/** Apply any messages in `msgs` beyond the first `seen`, returning the new count. */
async function applyMsgs(pc: RTCPeerConnection, msgs: Msg[], seen: number, onAnswerNeeded?: () => Promise<void>): Promise<number> {
  for (let i = seen; i < msgs.length; i++) {
    const m = msgs[i]!;
    try {
      if (m.t === "offer") {
        await pc.setRemoteDescription({ type: "offer", sdp: m.sdp });
        await onAnswerNeeded?.();
      } else if (m.t === "answer") {
        await pc.setRemoteDescription({ type: "answer", sdp: m.sdp });
      } else if (m.t === "ice") {
        await pc.addIceCandidate(m.c);
      }
    } catch {
      /* a stale or duplicate message must not stop the rest */
    }
  }
  return msgs.length;
}

/* ------------------------------------------------------------------ */
/* Viewer: a Vifug screen showing the phone's picture                  */
/* ------------------------------------------------------------------ */

export type CastViewerStatus = "waiting" | "connecting" | "live" | "lost";

const closers = new WeakMap<MediaStream, () => void>();
/** Stop receiving a stream returned by openCastStream. */
export function closeCastStream(stream: MediaStream | null | undefined) {
  if (stream) closers.get(stream)?.();
}

/**
 * Start receiving the picture for `room`. The stream is returned at once and
 * fills with video when the phone connects, so a screen can be showing it
 * before the phone has even opened the page.
 */
export function openCastStream(
  room: string,
  onStatus?: (s: CastViewerStatus) => void,
  signal: Signal = httpSignal,
): MediaStream {
  const stream = new MediaStream();
  let vid = rid();
  let pc: RTCPeerConnection | null = null;
  let closed = false;
  let seenFromSender = 0;
  let out: Msg[] = [];
  let lostSince = 0;
  const timers: ReturnType<typeof setInterval>[] = [];

  const setStatus = (s: CastViewerStatus) => onStatus?.(s);

  function reset() {
    pc?.close();
    pc = null;
    seenFromSender = 0;
    out = [];
    vid = rid(); // a fresh identity so the sender builds a fresh connection
    for (const t of stream.getTracks()) stream.removeTrack(t);
  }

  function ensurePc(): RTCPeerConnection {
    if (pc) return pc;
    const p = new RTCPeerConnection(RTC);
    p.ontrack = (e) => {
      for (const t of e.streams[0]?.getTracks() ?? [e.track]) if (!stream.getTracks().includes(t)) stream.addTrack(t);
    };
    p.onicecandidate = (e) => {
      if (!e.candidate) return;
      out.push({ t: "ice", c: e.candidate.toJSON() });
      void signal.put(room, `v:${vid}`, { msgs: out });
    };
    p.onconnectionstatechange = () => {
      if (p.connectionState === "connected") {
        lostSince = 0;
        setStatus("live");
      } else if (p.connectionState === "connecting") setStatus("connecting");
      else if (p.connectionState === "failed" || p.connectionState === "disconnected") {
        lostSince ||= Date.now();
        setStatus("lost");
      }
    };
    pc = p;
    return p;
  }

  setStatus("waiting");
  const hello = () => void signal.put(room, `hello:${vid}`, { closed: false });
  hello();
  timers.push(setInterval(hello, 2500));
  timers.push(
    setInterval(async () => {
      if (closed) return;
      // Connection dropped for good (phone went away and came back): start over.
      if (pc && lostSince && Date.now() - lostSince > 6000) {
        reset();
        lostSince = 0;
        setStatus("waiting");
        hello();
        return;
      }
      const r = await signal.get(room, `p:${vid}`);
      const msgs = ((r?.payload as { msgs?: Msg[] } | null)?.msgs ?? []) as Msg[];
      if (!msgs.length || msgs.length <= seenFromSender) return;
      const p = ensurePc();
      setStatus("connecting");
      seenFromSender = await applyMsgs(p, msgs, seenFromSender, async () => {
        const answer = await p.createAnswer();
        await p.setLocalDescription(answer);
        out.push({ t: "answer", sdp: answer.sdp ?? "" });
        await signal.put(room, `v:${vid}`, { msgs: out });
      });
    }, 700),
  );

  closers.set(stream, () => {
    closed = true;
    timers.forEach(clearInterval);
    void signal.put(room, `hello:${vid}`, { closed: true });
    pc?.close();
    pc = null;
    stream.getTracks().forEach((t) => t.stop());
  });
  return stream;
}

/* ------------------------------------------------------------------ */
/* Sender: the phone                                                   */
/* ------------------------------------------------------------------ */

export type CastSender = { viewers: () => number; stop: () => void };

/**
 * Send `stream` to every screen that asks for it in `room`. Returns a handle;
 * `onViewers` is told how many screens are currently connected.
 */
export function startCastSender(
  room: string,
  stream: MediaStream,
  onViewers?: (n: number) => void,
  signal: Signal = httpSignal,
): CastSender {
  type Peer = { pc: RTCPeerConnection; out: Msg[]; seen: number; connected: boolean };
  const peers = new Map<string, Peer>();
  let stopped = false;

  const count = () => [...peers.values()].filter((p) => p.connected).length;
  const report = () => onViewers?.(count());

  async function connectViewer(id: string) {
    const pc = new RTCPeerConnection(RTC);
    const peer: Peer = { pc, out: [], seen: 0, connected: false };
    peers.set(id, peer);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      peer.out.push({ t: "ice", c: e.candidate.toJSON() });
      void signal.put(room, `p:${id}`, { msgs: peer.out });
    };
    pc.onconnectionstatechange = () => {
      peer.connected = pc.connectionState === "connected";
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        pc.close();
        peers.delete(id);
      }
      report();
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    peer.out.push({ t: "offer", sdp: offer.sdp ?? "" });
    await signal.put(room, `p:${id}`, { msgs: peer.out });
  }

  const present = () => void signal.put(room, "sender", { live: true });
  present();
  const timers = [setInterval(present, 4000)];

  timers.push(
    setInterval(async () => {
      if (stopped) return;
      const list = await signal.list(room, "hello");
      if (!list) return;
      const fresh = new Map<string, boolean>();
      for (const e of list.entries) {
        const id = e.key.slice("hello:".length);
        const closed = (e.payload as { closed?: boolean } | null)?.closed === true;
        const alive = !closed && list.now - e.at < 9000;
        fresh.set(id, alive);
        if (alive && !peers.has(id)) void connectViewer(id);
        if (!alive && peers.has(id)) {
          peers.get(id)!.pc.close();
          peers.delete(id);
          report();
        }
      }
      // Answers and addresses from each viewer.
      for (const [id, peer] of peers) {
        const r = await signal.get(room, `v:${id}`);
        const msgs = ((r?.payload as { msgs?: Msg[] } | null)?.msgs ?? []) as Msg[];
        if (msgs.length > peer.seen) peer.seen = await applyMsgs(peer.pc, msgs, peer.seen);
      }
    }, 900),
  );

  return {
    viewers: count,
    stop() {
      stopped = true;
      timers.forEach(clearInterval);
      for (const p of peers.values()) p.pc.close();
      peers.clear();
      void signal.put(room, "sender", { live: false });
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

/** Is a sender present in `room` right now? For the "phone connected" light. */
export async function senderPresent(room: string, signal: Signal = httpSignal): Promise<boolean> {
  const r = await signal.get(room, "sender");
  if (!r) return false;
  return (r.payload as { live?: boolean } | null)?.live === true && r.now - r.at < 12000;
}
