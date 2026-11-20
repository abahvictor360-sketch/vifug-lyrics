// Shared explainer-card helper for guide videos. A card is a full-screen dark page injected over the app,
// leaving room at the bottom for the burned-in caption. Use only facts that are in docs/guide.html.
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
async function showCard(h, { kicker, title, items }) {
  await h.page.evaluate(({ kicker, title, items }) => {
    document.getElementById("vf-card")?.remove();
    const d = document.createElement("div"); d.id = "vf-card";
    d.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:#0b0e14;color:#f3f5f8;display:flex;flex-direction:column;justify-content:center;padding:36px 90px 120px;font-family:Sora,'IBM Plex Sans',system-ui,sans-serif";
    const li = items.map((t, i) => `<li style="display:flex;gap:16px;margin:0 0 16px;font-size:22px;line-height:1.4"><b style="flex:none;width:34px;height:34px;border-radius:50%;background:#a3e635;color:#0b0e14;display:flex;align-items:center;justify-content:center;font-size:17px">${i + 1}</b><span>${t}</span></li>`).join("");
    d.innerHTML = `<div style="color:#a3e635;font-weight:700;letter-spacing:.14em;font-size:15px;text-transform:uppercase;margin-bottom:10px">${kicker}</div><div style="font-size:38px;font-weight:700;margin-bottom:28px">${title}</div><ol style="list-style:none;margin:0;padding:0">${li}</ol>`;
    document.documentElement.appendChild(d);
  }, { kicker, title, items });
}
async function hideCard(h) { await h.page.evaluate(() => document.getElementById("vf-card")?.remove()); }
// Compatibility with other scenarios that call card.show(h, title, [[head, text], ...], note) / card.hide(h).
async function show(h, title, rows, note) {
  await showCard(h, { kicker: "Explainer", title, items: rows.map(([a, b]) => "<b>" + esc(a) + "</b> " + esc(b)).concat(note ? ["<i>" + esc(note) + "</i>"] : []) });
}
module.exports = { showCard, hideCard, esc, show, hide: hideCard };
