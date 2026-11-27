import { describe, expect, it } from "bun:test";
import { audioTrackKey, liveAudioTrack, phoneMicUrl } from "./phone-mic";

const track = (id: string, readyState: "live" | "ended" = "live") => ({ id, readyState }) as unknown as MediaStreamTrack;
const stream = (...tracks: MediaStreamTrack[]) => ({ getAudioTracks: () => tracks }) as unknown as MediaStream;

describe("phone microphone helpers", () => {
  it("finds the first live audio track, and ignores an ended one", () => {
    expect(liveAudioTrack(stream(track("a", "ended"), track("b")))?.id).toBe("b");
    expect(liveAudioTrack(stream())).toBeNull();
    expect(liveAudioTrack(null)).toBeNull();
  });

  it("the key changes when the phone arrives, drops and comes back on a new track", () => {
    const none = audioTrackKey(stream());
    const first = audioTrackKey(stream(track("a")));
    const dropped = audioTrackKey(stream(track("a", "ended")));
    const back = audioTrackKey(stream(track("c")));
    expect(none).toBe("");
    expect(first).toBe("a");
    expect(dropped).toBe("");
    expect(back).toBe("c");
    expect(new Set([first, back]).size).toBe(2);
  });

  it("the link carries the room and asks for the microphone page", () => {
    const url = phoneMicUrl("abc123xyz");
    expect(url).toMatch(/#\/cast\?room=abc123xyz&mic=1$/);
  });
});
