// Explainer card (bullets) for desktop-only steps. Facts on a card must come from the guide text only.
exports.showCard = async (h, { kicker, title, lines }) => {
  await h.page.evaluate(({ kicker, title, lines }) => {
    document.getElementById("vf-card")?.remove();
    const c = document.createElement("div"); c.id = "vf-card";
    c.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:#0b0e14;color:#f3f5f8;font-family:Sora,'IBM Plex Sans',system-ui,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 110px 90px;";
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    c.innerHTML = `<div style="color:#a3e635;font-size:15px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;margin-bottom:14px">${esc(kicker)}</div>
      <div style="font-size:42px;font-weight:700;line-height:1.15;margin-bottom:30px">${esc(title)}</div>
      ${lines.map((l) => `<div style="display:flex;gap:16px;font-size:24px;line-height:1.4;margin:8px 0;color:#d6dbe4"><span style="color:#a3e635">&#9656;</span><span>${esc(l)}</span></div>`).join("")}`;
    document.documentElement.appendChild(c);
  }, { kicker, title, lines });
};
exports.hideCard = async (h) => { await h.page.evaluate(() => document.getElementById("vf-card")?.remove()); };
