import { describe, expect, it } from "bun:test";
import { CODE_RE, registerRoom, roomOf, roomRegistered, stripSecrets } from "./pairing";

describe("pairing", () => {
  it("recognises a registered code by its hash only", async () => {
    const room = roomOf("123456");
    expect(room).not.toContain("123456");
    expect(await roomRegistered(room)).toBe(false);
    await registerRoom(room);
    expect(await roomRegistered(room)).toBe(true);
    expect(await roomRegistered(roomOf("654321"))).toBe(false);
  });

  it("accepts only six-digit codes", () => {
    expect(CODE_RE.test("123456")).toBe(true);
    expect(CODE_RE.test("12345")).toBe(false);
    expect(CODE_RE.test("1234567")).toBe(false);
    expect(CODE_RE.test("12a456")).toBe(false);
  });

  it("strips the Deepgram key and the shared PIN, keeps the rest", () => {
    const r = stripSecrets({ linesPerSlide: 2, deepgramApiKey: "dg_secret", remote: { requirePin: true, pin: "1234" }, ui: { language: "en" } });
    expect(r.changed).toBe(true);
    expect(JSON.stringify(r.config)).not.toContain("dg_secret");
    expect(JSON.stringify(r.config)).not.toContain("1234");
    expect(r.config.linesPerSlide).toBe(2);
    expect(stripSecrets({ linesPerSlide: 2 }).changed).toBe(false);
  });
});
