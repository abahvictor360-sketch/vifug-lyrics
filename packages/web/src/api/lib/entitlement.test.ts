import { describe, expect, it } from "bun:test";
import { DEFAULT_POLICY, hashKey, isAdmin, publicPolicy, sanitisePolicy, verifyLicence } from "./entitlement";

describe("entitlement policy", () => {
  it("is off by default", () => {
    expect(DEFAULT_POLICY.mode).toBe("off");
  });

  it("validates what an owner may set", () => {
    expect("error" in sanitisePolicy({ mode: "maybe" })).toBe(true);
    expect("error" in sanitisePolicy({ checkoutUrl: "http://insecure" })).toBe(true);
    expect("error" in sanitisePolicy({ minVersion: "latest" })).toBe(true);
    expect("error" in sanitisePolicy({ nagEveryHours: 0 })).toBe(true);
    const ok = sanitisePolicy({ mode: "nag", checkoutUrl: "https://pay.example.com/vifug", minVersion: "1.30.0", startsAt: "2027-01-01" });
    expect("policy" in ok && ok.policy.mode).toBe("nag");
    expect("policy" in ok && ok.policy.startsAt).toContain("2027-01-01");
  });

  it("stores licence keys as hashes only and never serves them", () => {
    const r = sanitisePolicy({ addKeys: ["VIFUG-ABCD-1234", "short"] });
    if (!("policy" in r)) throw new Error("expected a policy");
    expect(r.policy.keyHashes).toEqual([hashKey("VIFUG-ABCD-1234")]);
    expect(JSON.stringify(publicPolicy(r.policy))).not.toContain(hashKey("VIFUG-ABCD-1234"));
    expect(publicPolicy(r.policy).keyCount).toBe(1);
    expect(verifyLicence("vifug-abcd-1234 ", r.policy).valid).toBe(true);
    expect(verifyLicence("VIFUG-WRONG-0000", r.policy).valid).toBe(false);
    const removed = sanitisePolicy({ removeKeys: ["VIFUG-ABCD-1234"] }, r.policy);
    expect("policy" in removed && removed.policy.keyHashes).toEqual([]);
  });

  it("only trusts an admin token that is set and matches", () => {
    expect(isAdmin("anything", undefined)).toBe(false);
    expect(isAdmin("short", "short")).toBe(false);
    expect(isAdmin(undefined, "a-long-enough-secret-token")).toBe(false);
    expect(isAdmin("a-long-enough-secret-token", "a-long-enough-secret-token")).toBe(true);
    expect(isAdmin("a-long-enough-secret-tokeX", "a-long-enough-secret-token")).toBe(false);
  });
});
