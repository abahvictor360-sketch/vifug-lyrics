const L = require("./_s4211.cjs");
const C = require("./_cards.cjs");
module.exports = {
  name: "vifug-promo",
  async setup(h) { await h.goto("/"); },
  steps: [
    { caption: "Vifug: free presentation software for church",
      say: "Vifug is free presentation software for church. Here is a quick look at it.",
      run: async (h) => { await h.sleep(1); } },
    { caption: "1. 325 songs are built in. Search, pick a song, press Go Live.",
      say: "One. Three hundred and twenty five songs are built in. Search for one, pick it, and press Go Live.",
      run: async (h) => { await L.openSongLive(h, "amazing", "Amazing Grace!", "Amazing grace! how sweet the sound!"); await L.showLive(h, "WHAT THE ROOM SEES"); await h.sleep(3.5); }, minHold: 4 },
    { caption: "2. The Bible is built in too, and works offline.",
      say: "Two. The Bible is built in too, and it works without the internet. Type a reference and send a verse live.",
      run: async (h) => {
        await L.hideLive(h);
        await h.click(h.page.getByRole("button", { name: /^Bible/ }).first());
        const ref = h.page.locator('input[placeholder^="Reference"]');
        await L.typeSafe(h, ref, "john 3");
        await ref.press("Enter"); await h.sleep(1.2);
        await h.page.getByText("The same came to Jesus by night").first().dblclick();
        await h.sleep(0.8);
        await L.showLive(h, "WHAT THE ROOM SEES", "/#/projector", "Jesus");
        await h.sleep(3.5);
      }, minHold: 4 },
    { caption: "3. A countdown timer: in a corner, or filling the screen.",
      say: "Three. A countdown timer can sit in a corner, or fill the whole screen, in any colour you like.",
      run: async (h) => {
        await L.hideLive(h);
        await h.click(h.page.getByLabel("Countdown timer"));
        await h.page.getByLabel("Timer position").selectOption("center"); await h.sleep(0.4);
        await h.click(h.page.getByRole("button", { name: "5m", exact: true }));
        await h.click(h.page.getByRole("button", { name: "Start", exact: true }));
        await h.click(h.page.getByText("More timer settings"));
        await h.click(h.page.getByRole("button", { name: "Main screen", exact: true }));
        await h.click(h.page.getByRole("button", { name: "Colour", exact: true }));
        await h.page.getByLabel("Timer background colour").evaluate((e) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(e, "#1d4ed8"); e.dispatchEvent(new Event("input", { bubbles: true })); });
        await h.sleep(0.5);
        await h.click(h.page.getByRole("button", { name: "Digit colour #FFD54A" }));
        await h.sleep(0.5);
        await h.click(h.page.getByRole("button", { name: "Done" }));
        await L.showLive(h, "WHAT THE ROOM SEES", "/#/projector", "");
        await h.sleep(4);
      }, minHold: 5 },
    { caption: "4. Works with OBS, vMix, phones and a stage display.",
      say: "Four. It sends a transparent overlay to OBS or vMix, and it has a stage display for the band and a remote for your phone.",
      run: async (h) => {
        await L.hideLive(h);
        await C.showCard(h, { kicker: "What else is in it", title: "Built for a real service", items: [
          "A transparent overlay for <b>OBS</b> and <b>vMix</b>, and <b>NDI</b> on the desktop app",
          "A <b>stage display</b> for the band and a <b>phone remote</b>",
          "<b>AI auto-follow</b> that listens and brings up the verse being read",
          "Import from <b>PowerPoint</b>, <b>PDF</b>, <b>ProPresenter</b> and <b>EasyWorship</b>",
        ] });
      }, minHold: 7 },
    { caption: "Free. No watermark. Windows, Mac, Linux, or in your browser.",
      say: "Vifug is free, with no watermark. Get it for Windows, Mac or Linux at vifug dot com, or try it in your browser at app dot vifug dot com.",
      run: async (h) => {
        await C.hideCard(h);
        await h.page.evaluate(() => {
          const d = document.createElement("div"); d.id = "vf-card";
          d.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:#0b0e14;color:#f3f5f8;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 90px 120px;font-family:Sora,'IBM Plex Sans',system-ui,sans-serif;text-align:center";
          d.innerHTML = '<div style="font-size:64px;font-weight:800;letter-spacing:-.01em;margin-bottom:10px">Vifug</div>' +
            '<div style="font-size:26px;color:#a3e635;margin-bottom:34px">Free church presentation software</div>' +
            '<div style="font-size:30px;margin-bottom:12px">Download: <b>vifug.com</b></div>' +
            '<div style="font-size:30px">Try it in your browser: <b>app.vifug.com</b></div>';
          document.documentElement.appendChild(d);
        });
      }, minHold: 7 },
  ],
};
