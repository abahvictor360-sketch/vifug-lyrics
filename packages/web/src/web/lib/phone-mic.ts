/**
 * A phone as the room microphone for AI auto-follow.
 *
 * It rides on the phone camera pairing (lib/cast.ts): the phone opens a page
 * and sends its microphone - audio only - straight to this computer over
 * WebRTC, and auto-follow listens to that in place of a microphone plugged
 * into the computer. The pairing goes through the hosted address because a
 * phone only lets a page use its microphone over https, which a Vifug on the
 * local network is not. The audio itself does not go through that server.
 *
 * The room code is the only thing protecting the feed, so it is random and is
 * kept in settings, which is also how the phone remote knows it.
 */
import { castOrigin, newRoomCode } from "./cast";

/** Thrown by the microphone opener while the phone has not connected yet. */
export const PHONE_MIC_WAITING = "phone-mic-waiting";

/** The link a phone opens to become the microphone for `room`. */
export const phoneMicUrl = (room: string) => `${castOrigin()}/#/cast?room=${room}&mic=1`;

export { newRoomCode as newPhoneMicRoom };

/** The first live audio track on a stream, or null while nothing has connected. */
export function liveAudioTrack(stream: MediaStream | null | undefined): MediaStreamTrack | null {
  return stream?.getAudioTracks().find((t) => t.readyState === "live") ?? null;
}

/** A change in this string means the phone connected, dropped or reconnected. */
export const audioTrackKey = (stream: MediaStream | null | undefined): string =>
  (stream?.getAudioTracks() ?? []).filter((t) => t.readyState === "live").map((t) => t.id).join(",");
