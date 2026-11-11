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

export type StreamQuality =
  | "720p30" | "1080p30" | "1080p60"
  | "1440p30" | "1440p60" | "2160p30" | "2160p60" | "4320p30" | "4320p60";

export type StreamEncoder = "x264" | "nvenc" | "qsv" | "amf" | "videotoolbox";

export const STREAM_ENCODERS: { id: StreamEncoder; label: string }[] = [
  { id: "x264", label: "Software (x264) - works on every computer" },
  { id: "nvenc", label: "NVIDIA graphics card (NVENC)" },
  { id: "qsv", label: "Intel graphics (Quick Sync)" },
  { id: "amf", label: "AMD graphics card (AMF)" },
  { id: "videotoolbox", label: "Apple hardware (VideoToolbox)" },
];

export type StreamConfig = {
  destinations: StreamDestination[];
  quality: StreamQuality;
  /** Send the microphone chosen in Settings with the picture. */
  microphone: boolean;
  /** Which H.264 encoder does the work. Hardware ones carry 4K far more easily. */
  encoder: StreamEncoder;
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

export const STREAM_QUALITIES: {
  id: StreamQuality;
  label: string;
  width: number;
  height: number;
  fps: number;
  videoKbps: number;
}[] = [
  { id: "720p30", label: "720p HD · 30 fps (about 4 Mbps upload)", width: 1280, height: 720, fps: 30, videoKbps: 2800 },
  { id: "1080p30", label: "1080p Full HD · 30 fps (about 6 Mbps)", width: 1920, height: 1080, fps: 30, videoKbps: 4500 },
  { id: "1080p60", label: "1080p Full HD · 60 fps (about 9 Mbps)", width: 1920, height: 1080, fps: 60, videoKbps: 6500 },
  { id: "1440p30", label: "1440p 2K · 30 fps (about 12 Mbps)", width: 2560, height: 1440, fps: 30, videoKbps: 9000 },
  { id: "1440p60", label: "1440p 2K · 60 fps (about 17 Mbps)", width: 2560, height: 1440, fps: 60, videoKbps: 13000 },
  { id: "2160p30", label: "2160p 4K · 30 fps (about 25 Mbps)", width: 3840, height: 2160, fps: 30, videoKbps: 20000 },
  { id: "2160p60", label: "2160p 4K · 60 fps (about 38 Mbps)", width: 3840, height: 2160, fps: 60, videoKbps: 30000 },
  { id: "4320p30", label: "4320p 8K · 30 fps (about 100 Mbps)", width: 7680, height: 4320, fps: 30, videoKbps: 80000 },
  { id: "4320p60", label: "4320p 8K · 60 fps (about 150 Mbps)", width: 7680, height: 4320, fps: 60, videoKbps: 120000 },
];

const KEY = "vifug:stream-config";

export const DEFAULT_STREAM_CONFIG: StreamConfig = { destinations: [], quality: "720p30", microphone: true, encoder: "x264" };

export function loadStreamConfig(): StreamConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STREAM_CONFIG;
    const v = JSON.parse(raw) as Partial<StreamConfig>;
    return {
      destinations: Array.isArray(v.destinations) ? v.destinations : [],
      quality: STREAM_QUALITIES.some((q) => q.id === v.quality) ? (v.quality as StreamQuality) : "720p30",
      microphone: v.microphone !== false,
      encoder: STREAM_ENCODERS.some((e) => e.id === v.encoder) ? (v.encoder as StreamEncoder) : "x264",
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
