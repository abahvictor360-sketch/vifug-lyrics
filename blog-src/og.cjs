// Renders a 1200x630 social card per post into docs/blog/og/. Run after build.py:
//   NODE_PATH=$(npm root -g) node blog-src/og.cjs
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..");
const posts = JSON.parse(fs.readFileSync(path.join(__dirname, "posts.json"), "utf8"));
const out = path.join(root, "docs", "blog", "og");
fs.mkdirSync(out, { recursive: true });
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const card = (p) => `<html><body style="margin:0;width:1200px;height:630px;background:radial-gradient(900px 500px at 85% -10%,rgba(163,230,53,.22),transparent 60%),#080a0f;color:#eef1f6;font-family:Sora,'Segoe UI',system-ui,sans-serif;display:flex;flex-direction:column;justify-content:space-between;padding:68px 80px;box-sizing:border-box">
<div style="display:flex;align-items:center;gap:14px;font-weight:700;font-size:30px"><span style="width:44px;height:44px;border-radius:12px;background:linear-gradient(150deg,#a3e635,#7cc00a);display:grid;place-items:center"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#080a0f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><path d="m9 9 12-2"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span>Vifug <span style="font-weight:500;color:#7a849c;margin-left:6px">Blog</span></div>
<div><div style="color:#a3e635;font-size:22px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;margin-bottom:22px">${esc(p.category)}</div>
<div style="font-size:${p.title.length > 62 ? 52 : 60}px;line-height:1.12;font-weight:800;letter-spacing:-.02em;max-width:1040px">${esc(p.title)}</div></div>
<div style="color:#9aa3b8;font-size:24px">vifug.com · Free presentation software</div></body></html>`;
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1200, height: 630 } });
  for (const p of posts) {
    await pg.setContent(card(p));
    await pg.screenshot({ path: path.join(out, p.slug + ".png"), type: "png" });
  }
  await b.close();
  console.log("og images:", posts.length);
})();
