/**
 * Run with: bun test src/web/components/logo-overlay.test.tsx
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LogoOverlay, DEFAULT_LOGO } from "./logo-overlay";

const on = { ...DEFAULT_LOGO, enabled: true, url: "https://example.com/logo.png" };
const html = (logo: Parameters<typeof LogoOverlay>[0]["logo"], hasVideo = true) =>
  renderToStaticMarkup(<LogoOverlay logo={logo} hasVideo={hasVideo} />);

test("draws nothing unless enabled and given an image", () => {
  expect(html(null)).toBe("");
  expect(html({ ...on, enabled: false })).toBe("");
  expect(html({ ...on, url: null })).toBe("");
});

test("sits in the chosen top corner", () => {
  expect(html({ ...on, position: "top-left" })).toContain("left:2.5%");
  expect(html({ ...on, position: "top-right" })).toContain("right:2.5%");
});

test("onlyOverVideo hides it when no capture is live", () => {
  expect(html({ ...on, onlyOverVideo: true }, false)).toBe("");
  expect(html({ ...on, onlyOverVideo: true }, true)).toContain("<img");
  expect(html({ ...on, onlyOverVideo: false }, false)).toContain("<img");
});

test("size and opacity are clamped to sane values", () => {
  const big = html({ ...on, sizePct: 500, opacity: 5 });
  expect(big).toContain("width:40%");
  expect(big).toContain("opacity:1");
  const small = html({ ...on, sizePct: 0.1, opacity: 0 });
  expect(small).toContain("width:3%");
  expect(small).toContain("opacity:0.2");
});

test("never takes clicks from the picture under it", () => {
  expect(html(on)).toContain("pointer-events:none");
});
