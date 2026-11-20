// Explainer card used by install-first-run and browser-and-phones. rows: [[heading, text], ...]
module.exports = {
  show: (h, title, rows, foot) => h.page.evaluate(([t, r, f]) => {
    document.getElementById("vf-card")?.remove();
    const d = document.createElement("div"); d.id = "vf-card";
    d.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:#0b0e14;color:#f3f5f8;font-family:Sora,'IBM Plex Sans',system-ui,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:36px 90px 110px;box-sizing:border-box";
    d.innerHTML = '<div style="color:#a3e635;font-size:15px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px">Explainer</div>'
      + '<div style="font-size:38px;font-weight:700;margin-bottom:22px">' + t + '</div>'
      + r.map(([a, b]) => '<div style="display:flex;gap:22px;margin:7px 0;font-size:22px;line-height:1.35"><div style="flex:0 0 250px;color:#a3e635;font-weight:600">' + a + '</div><div style="color:#d6dbe4">' + b + '</div></div>').join("")
      + (f ? '<div style="margin-top:20px;font-size:18px;color:#8b93a3">' + f + '</div>' : "");
    document.documentElement.appendChild(d);
  }, [title, rows, foot || ""]),
  hide: (h) => h.page.evaluate(() => document.getElementById("vf-card")?.remove()),
};
