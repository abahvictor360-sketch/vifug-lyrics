// Renders the Vifug logo intro (1280x720, 30 fps, 2.5 s) to a PNG sequence, then encodes intro.mp4.
// Usage: NODE_PATH=$(npm root -g) node tools/guide-video/intro.cjs OUT_DIR
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), cp = require("child_process");
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const FPS = 30, DUR = 2.5, N = Math.round(FPS * DUR);
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const clamp = (x) => Math.min(1, Math.max(0, x));
const html = `<html><body style="margin:0;width:1280px;height:720px;overflow:hidden;background:#080a0f;font-family:Sora,'Segoe UI',system-ui,sans-serif">
<div id="glow" style="position:absolute;inset:0;background:radial-gradient(520px 340px at 50% 48%,rgba(163,230,53,.22),transparent 70%)"></div>
<div id="row" style="position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;gap:28px">
  <div id="mark" style="width:132px;height:132px;border-radius:34px;background:linear-gradient(150deg,#a3e635,#7cc00a);display:grid;place-items:center;box-shadow:0 12px 50px rgba(163,230,53,.38)">
    <svg width="76" height="76" viewBox="0 0 24 24" fill="none" stroke="#080a0f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><path d="m9 9 12-2"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
  </div>
  <div id="word" style="font-weight:800;font-size:112px;letter-spacing:-.03em;color:#eef1f6">Vifug</div>
</div>
<div id="tag" style="position:absolute;left:0;right:0;top:450px;text-align:center;font:500 26px 'IBM Plex Sans',system-ui,sans-serif;color:#9aa3b8;letter-spacing:.04em">Free presentation software for churches and live events</div>
</body></html>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  for (let i = 0; i < N; i++) {
    const t = i / FPS;
    const fade = 1 - ease((t - (DUR - 0.35)) / 0.35);           // fade to black at the end
    const g = ease(t / 0.6), m = ease((t - 0.15) / 0.6), w = ease((t - 0.5) / 0.6), tg = ease((t - 0.95) / 0.6);
    await p.evaluate(({ g, m, w, tg, fade }) => {
      document.getElementById("glow").style.opacity = g * fade;
      const mk = document.getElementById("mark"); mk.style.opacity = m * fade; mk.style.transform = `scale(${0.78 + 0.22 * m})`;
      const wd = document.getElementById("word"); wd.style.opacity = w * fade; wd.style.transform = `translateX(${(1 - w) * -24}px)`;
      const tag = document.getElementById("tag"); tag.style.opacity = tg * fade; tag.style.transform = `translateY(${(1 - tg) * 10}px)`;
    }, { g, m, w, tg, fade });
    await p.screenshot({ path: path.join(out, `f${String(i).padStart(4, "0")}.png`) });
  }
  await b.close();
  cp.execFileSync("ffmpeg", ["-v","error","-y","-framerate",String(FPS),"-i",path.join(out,"f%04d.png"),"-c:v","libx264","-pix_fmt","yuv420p","-crf","16","-r",String(FPS),path.join(out,"intro.mp4")]);
  console.log("intro.mp4", N, "frames");
})();
