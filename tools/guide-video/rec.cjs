// Record a guide video from a scenario file. Every step has an on-screen caption and a spoken line;
// the step lasts at least as long as its narration, so picture and voice cannot drift apart.
//
//   node rec.cjs say    SCENARIO.cjs OUTDIR            -> OUTDIR/say.json  (lines to synthesize)
//   node rec.cjs record SCENARIO.cjs OUTDIR [BASEURL]  -> OUTDIR/raw.webm + OUTDIR/steps.json (needs OUTDIR/tts.json)
//
// A scenario exports { name, steps: [{ caption, say, run?: async (h) => {}, minHold?: seconds }] }
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const [mode, scenarioPath, outDir, baseArg] = process.argv.slice(2);
const sc = require(path.resolve(scenarioPath));
fs.mkdirSync(outDir, { recursive: true });
const BASE = baseArg || "http://localhost:4200";

if (mode === "say") {
  fs.writeFileSync(path.join(outDir, "say.json"), JSON.stringify(sc.steps.map((s) => s.say || ""), null, 1));
  console.log("lines:", sc.steps.length); process.exit(0);
}

const CAPTION_CSS = `
#vf-cap{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483646;max-width:1000px;
 background:#0b0e14;color:#f3f5f8;border:1.5px solid #a3e635;border-radius:16px;padding:12px 24px;
 font:600 21px/1.35 Sora,"IBM Plex Sans",system-ui,sans-serif;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.45);
 transition:opacity .18s;pointer-events:none}
#vf-cur{position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;margin:-2px 0 0 -2px;
 transition:none}
#vf-rip{position:fixed;z-index:2147483645;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;
 border:3px solid #a3e635;pointer-events:none;opacity:0}
#vf-rip.go{animation:vfrip .5s ease-out}
@keyframes vfrip{0%{opacity:.95;transform:scale(.4)}100%{opacity:0;transform:scale(1.5)}}`;
const INIT = `(() => {
  const add = () => {
    if (document.getElementById("vf-cap")) return;
    const st = document.createElement("style"); st.textContent = ${JSON.stringify(CAPTION_CSS)}; document.documentElement.appendChild(st);
    const cap = document.createElement("div"); cap.id = "vf-cap"; cap.style.opacity = 0; document.documentElement.appendChild(cap);
    const cur = document.createElement("div"); cur.id = "vf-cur";
    cur.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 2l7 18 2.6-7.4L20 10z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    cur.style.transform = "translate(-100px,-100px)"; document.documentElement.appendChild(cur);
    const rip = document.createElement("div"); rip.id = "vf-rip"; document.documentElement.appendChild(rip);
    addEventListener("mousemove", e => { cur.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)"; }, true);
    addEventListener("mousedown", e => { rip.style.left = e.clientX + "px"; rip.style.top = e.clientY + "px"; rip.classList.remove("go"); void rip.offsetWidth; rip.classList.add("go"); }, true);
  };
  if (document.documentElement) add(); else document.addEventListener("DOMContentLoaded", add);
  new MutationObserver(add).observe(document, { childList: true });
})();`;

(async () => {
  const tts = JSON.parse(fs.readFileSync(path.join(outDir, "tts.json"), "utf8")); // seconds per line
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1,
    recordVideo: { dir: path.join(outDir, "rec"), size: { width: 1280, height: 720 } },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await ctx.route(/app\.vifug\.com|googletagmanager/, (r) => r.abort()); // blocked in the sandbox; do not wait on them
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const T0 = Date.now(); const now = () => (Date.now() - T0) / 1000;
  const sleep = (s) => page.waitForTimeout(Math.round(s * 1000));
  let mx = 640, my = 360;
  const h = {
    page, BASE, sleep, now,
    async goto(p = "/", ready = 'input[placeholder^="Search library"]') {
      await page.goto(BASE + p, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(ready, { timeout: 30000 }); await sleep(0.8);
    },
    async glide(x, y, ms = 650) { // visible, smooth pointer travel
      const n = Math.max(6, Math.round(ms / 25));
      for (let i = 1; i <= n; i++) { const t = i / n, e = t < .5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;
        await page.mouse.move(mx + (x-mx)*e, my + (y-my)*e); await sleep(ms / n / 1000); }
      mx = x; my = y;
    },
    async click(target, opts = {}) {
      const el = typeof target === "string" ? page.locator(target).first() : target;
      await el.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {});
      const b = await el.boundingBox({ timeout: 8000 });
      if (!b) throw new Error("no box for " + target);
      await h.glide(b.x + b.width * (opts.fx ?? 0.5), b.y + b.height * (opts.fy ?? 0.5));
      await sleep(0.15); await page.mouse.down(); await sleep(0.06); await page.mouse.up(); await sleep(opts.after ?? 0.35);
    },
    async type(target, text, delay = 55) { await h.click(target); await page.keyboard.type(text, { delay }); await sleep(0.3); },
    async press(k, after = 0.4) { await page.keyboard.press(k); await sleep(after); },
  };
  const steps = []; const gap = 0.45;
  await sc.setup?.(h);
  for (let i = 0; i < sc.steps.length; i++) {
    const s = sc.steps[i];
    const t0 = now();
    await page.evaluate((c) => { const e = document.getElementById("vf-cap"); if (e) { e.textContent = c; e.style.opacity = c ? 1 : 0; } }, s.caption || "");
    await s.run?.(h);
    const need = Math.max(tts[i] + gap, s.minHold || 0);
    const spent = now() - t0; if (spent < need) await sleep(need - spent);
    steps.push({ i, start: t0, end: now(), say: s.say || "", caption: s.caption || "" });
    console.log(i, t0.toFixed(1), "->", now().toFixed(1), (s.caption || "").slice(0, 60));
  }
  await sleep(0.6);
  const total = now();
  const vpath = await page.video().path();
  await ctx.close(); await browser.close();
  fs.copyFileSync(vpath, path.join(outDir, "raw.webm"));
  fs.writeFileSync(path.join(outDir, "steps.json"), JSON.stringify({ total, steps }, null, 1));
  console.log("recorded", total.toFixed(1), "s");
})().catch((e) => { console.error(e); process.exit(1); });
