import { useEffect, useState } from "react";
import { closeCastStream, openCastStream, type CastViewerStatus } from "../lib/cast";
import { audioTrackKey } from "../lib/phone-mic";

/**
 * Listen for a phone sending its microphone to `room`.
 *
 * Returns the stream (it fills with audio when the phone connects), what the
 * connection is doing, and a key that changes whenever the phone's audio
 * appears, goes or comes back - which is what tells auto-follow to restart on
 * the new track. Polled, because a MediaStream does not announce tracks that
 * script adds to it, and that is how a received stream is filled.
 */
export function usePhoneMic(room: string | null | undefined, enabled: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CastViewerStatus | "off">("off");
  const [trackKey, setTrackKey] = useState("");

  useEffect(() => {
    if (!enabled || !room) {
      setStream(null);
      setStatus("off");
      setTrackKey("");
      return;
    }
    const s = openCastStream(room, setStatus);
    setStream(s);
    const poll = setInterval(() => setTrackKey(audioTrackKey(s)), 500);
    return () => {
      clearInterval(poll);
      closeCastStream(s);
      setStream(null);
      setStatus("off");
      setTrackKey("");
    };
  }, [room, enabled]);

  return { stream, status, trackKey, connected: trackKey !== "" };
}

export type PhoneMic = ReturnType<typeof usePhoneMic>;
