/**
 * Where a live stream goes: YouTube, Facebook, Twitch, or any RTMP server.
 *
 * Kept in this browser's own storage rather than the shared settings record.
 * A stream key lets anyone who holds it broadcast to that channel, so it has
 * no business in a library backup or on a hosted server - it stays on the
 * computer that streams.
 */

export type StreamPlatform = "youtube" | "facebook" | "twitch" | "custom";

export type StreamDestination = {
  id: string;
  platform: StreamPlatform;
  /** Shown in the list; defaults to the platform's name. */
  name: string;
  /** RTMP server address, without the key. */
  server: string;
  key: string;
  enabled: boolean;
};

export type StreamQuality = "720p30" | "1080p30" | "1080p60";

export type StreamConfig = {
  destinations: StreamDestination[];
  quality: StreamQuality;
  /** Send the microphone chosen in Settings with the picture. */
  microphone: boolean;
};

export const STREAM_PLATFORMS: { id: StreamPlatform; label: string; server: string; keyHelp: string }[] = [
  {
    id: "youtube",
    label: "YouTube",
    server: "rtmp://a.rtmp.youtube.com/live2",
    keyHelp: "YouTube Studio → Create → Go live → Stream → Stream key",
  },
  {
    id: "facebook",
    label: "Facebook",
    server: "rtmps://live-api-s.facebook.com:443/rtmp/",
    keyHelp: "Facebook → Live video → Streaming software → Stream key",
  },
  {
    id: "twitch",
    label: "Twitch",
    server: "rtmp://live.twitch.tv/app",
    keyHelp: "Twitch → Creator Dashboard → Settings → Stream → Primary stream key",
  },
  {
    id: "custom",
    label: "Other (RTMP)",
    server: "",
    keyHelp: "TikTok, Instagram, Kick, X, Vimeo, a restream service or your own server: paste the server URL and stream key they give you",
  },
];

export const STREAM_QUALITIES: { id: StreamQuality; label: string; height: number; fps: number; videoKbps: number }[] = [
  { id: "720p30", label: "720p · 30 fps (needs about 4 Mbps upload)", height: 720, fps: 30, videoKbps: 2800 },
  { id: "1080p30", label: "1080p · 30 fps (about 6 Mbps)", height: 1080, fps: 30, videoKbps: 4500 },
  { id: "1080p60", label: "1080p · 60 fps (about 9 Mbps)", height: 1080, fps: 60, videoKbps: 6500 },
];

const KEY = "vifug:stream-config";

export const DEFAULT_STREAM_CONFIG: StreamConfig = { destinations: [], quality: "720p30", microphone: true };

export function loadStreamConfig(): StreamConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STREAM_CONFIG;
    const v = JSON.parse(raw) as Partial<StreamConfig>;
    return {
      destinations: Array.isArray(v.destinations) ? v.destinations : [],
      quality: STREAM_QUALITIES.some((q) => q.id === v.quality) ? (v.quality as StreamQuality) : "720p30",
      microphone: v.microphone !== false,
    };
  } catch {
    return DEFAULT_STREAM_CONFIG;
  }
}

export function saveStreamConfig(c: StreamConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
    window.dispatchEvent(new Event("vifug:stream-config"));
  } catch {
    /* private window: the destinations just are not remembered */
  }
}

/** The address ffmpeg publishes to: server + "/" + key. */
export function destinationUrl(d: StreamDestination): string | null {
  const server = d.server.trim().replace(/\/+$/, "");
  const key = d.key.trim();
  if (!/^rtmps?:\/\//i.test(server) || !key) return null;
  return `${server}/${key}`;
}

export function readyDestinations(c: StreamConfig): StreamDestination[] {
  return c.destinations.filter((d) => d.enabled && destinationUrl(d) !== null);
}
