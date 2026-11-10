import { describe, expect, it } from "bun:test";
import { castGet, castList, castPut, KEY_RE, ROOM_RE } from "./cast-store";

describe("cast-store (in memory)", () => {
  it("stores, reads and lists by prefix, per room", async () => {
    await castPut("room12345", "hello:aaaa11", { closed: false });
    await castPut("room12345", "hello:bbbb22", { closed: false });
    await castPut("room12345", "p:aaaa11", { msgs: [{ t: "offer", sdp: "x" }] });
    await castPut("other9999", "hello:cccc33", {});
    expect((await castGet("room12345", "p:aaaa11"))?.payload).toEqual({ msgs: [{ t: "offer", sdp: "x" }] });
    expect(await castGet("room12345", "v:aaaa11")).toBeNull();
    const hellos = await castList("room12345", "hello:");
    expect(hellos.map((h) => h.key).sort()).toEqual(["hello:aaaa11", "hello:bbbb22"]);
  });

  it("rejects oversized payloads and validates names", async () => {
    expect(await castPut("room12345", "sender", { blob: "x".repeat(70_000) })).toBe(false);
    expect(ROOM_RE.test("abc12345")).toBe(true);
    expect(ROOM_RE.test("../etc")).toBe(false);
    expect(KEY_RE.test("hello:abcd")).toBe(true);
    expect(KEY_RE.test("sender")).toBe(true);
    expect(KEY_RE.test("hello:../x")).toBe(false);
  });
});
