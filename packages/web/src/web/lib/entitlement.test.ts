import { describe, expect, it } from "bun:test";
import { evaluate, isOlderThan, type PublicPolicy } from "./entitlement";

const base: PublicPolicy = {
  mode: "off", startsAt: null, title: "t", message: "m", checkoutUrl: "https://pay.example.com", minVersion: "",
  updateUrl: "https://x.test/download", nagEveryHours: 24, updatedAt: "",
};
const NOW = Date.parse("2027-03-01T12:00:00Z");
const run = (p: Partial<PublicPolicy> | null, o: Partial<Parameters<typeof evaluate>[0]> = {}) =>
  evaluate({ policy: p ? { ...base, ...p } : null, licensed: false, appVersion: null, now: NOW, nagDismissedAt: null, ...o });

describe("evaluate", () => {
  it("does nothing while off, or with no answer", () => {
    expect(run({ mode: "off" })).toBe("ok");
    expect(run(null)).toBe("ok");
  });

  it("locks, nags, and respects licences", () => {
    expect(run({ mode: "lock" })).toBe("lock");
    expect(run({ mode: "lock" }, { licensed: true })).toBe("ok");
    expect(run({ mode: "nag" })).toBe("nag");
    expect(run({ mode: "nag" }, { licensed: true })).toBe("ok");
  });

  it("waits for a scheduled start", () => {
    expect(run({ mode: "lock", startsAt: "2027-04-01T00:00:00Z" })).toBe("ok");
    expect(run({ mode: "lock", startsAt: "2027-02-01T00:00:00Z" })).toBe("lock");
  });

  it("nags again only after the quiet period", () => {
    const hour = 3600 * 1000;
    expect(run({ mode: "nag", nagEveryHours: 24 }, { nagDismissedAt: NOW - 3 * hour })).toBe("ok");
    expect(run({ mode: "nag", nagEveryHours: 24 }, { nagDismissedAt: NOW - 25 * hour })).toBe("nag");
  });

  it("forces an update even for a licensed copy, but never in a browser", () => {
    expect(run({ minVersion: "1.30.0" }, { appVersion: "1.28.0", licensed: true })).toBe("update");
    expect(run({ minVersion: "1.30.0" }, { appVersion: "1.30.0" })).toBe("ok");
    expect(run({ minVersion: "1.30.0" }, { appVersion: null })).toBe("ok");
    expect(run({ minVersion: "1.30.0", startsAt: "2027-04-01T00:00:00Z" }, { appVersion: "1.0.0" })).toBe("ok");
  });

  it("compares versions numerically", () => {
    expect(isOlderThan("1.9.0", "1.10.0")).toBe(true);
    expect(isOlderThan("1.10.0", "1.9.0")).toBe(false);
    expect(isOlderThan("junk", "1.0.0")).toBe(false);
  });
});
