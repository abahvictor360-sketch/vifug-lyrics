const { showCard, hideCard } = require("./_cards-obs-ts.cjs");
// Settings pane helpers
async function openSettings(h) { await h.click(h.page.getByRole("button", { name: "Settings" }).first()); await h.sleep(0.5); }
async function nav(h, text) { await h.click(h.page.getByText(text, { exact: true }).first()); await h.sleep(0.6); }
async function scrollTo(h, text) {
  await h.page.getByText(text, { exact: true }).first().evaluate((e) => e.scrollIntoView({ block: "start", behavior: "smooth" }));
  await h.sleep(0.9);
}
module.exports = {
  name: "obs-vmix-ndi",
  async setup(h) { await h.goto("/"); },
  steps: [
    { caption: "Your lyrics in OBS or vMix", say: "Putting your lyrics into O B S or v Mix.", minHold: 3 },
    { caption: "1. Open Settings, then Streaming and output.", say: "Open Settings, then Streaming and output.",
      run: async (h) => { await openSettings(h); await h.click(h.page.getByText("Streaming & output", { exact: true }).first()); await h.sleep(0.5); } },
    { caption: "2. Pick the overlay canvas size your OBS canvas uses.", say: "Set the overlay canvas size to match your O B S canvas.",
      run: async (h) => { await scrollTo(h, "Overlay canvas size"); await h.glide(1100, 330); await h.sleep(0.3); } },
    { caption: "3. NDI: native output is desktop only. Browser: use the OBS bridge.", say: "Native N D I output runs in the desktop app. In a browser, let O B S emit N D I from the overlay.",
      run: async (h) => { await scrollTo(h, "NDI output"); await h.glide(700, 400, 900); } },
    { caption: "4. Stream / OBS source holds the overlay address. Copy it.", say: "Here is the overlay address. Copy it.",
      run: async (h) => { await scrollTo(h, "Stream / OBS source"); await h.click(h.page.getByRole("button", { name: /Copy the stream address/ })); } },
    { caption: "5. Teleport to OBS / vMix does the set-up in one click.", say: "Teleport to O B S slash v Mix adds it as a source in one click.",
      run: async (h) => { await scrollTo(h, "Teleport to OBS / vMix"); await h.glide(700, 330, 900); } },
    { caption: "6. Go live as usual. The overlay follows.", say: "Go live as usual.",
      run: async (h) => {
        await h.click(h.page.getByRole("button", { name: "Done", exact: true }));
        await h.click(h.page.getByText("Amazing Grace!").first());
        await h.click(h.page.locator("text=Amazing grace! how sweet the sound!").first());
        await h.click(h.page.getByRole("button", { name: /GO LIVE/i }));
      } },
    { caption: "7. Opened in a second window, the overlay is transparent.", say: "In a second window, the overlay is transparent, so only the lyrics show. The checkerboard just shows that.",
      run: async (h) => {
        await h.page.evaluate((base) => {
          const d = document.createElement("div"); d.id = "vf-card";
          d.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:#0b0e14;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:22px;font-family:Sora,system-ui,sans-serif;color:#f3f5f8";
          d.innerHTML = '<div style="font-size:15px;margin-bottom:10px;color:#a3e635;font-weight:700;letter-spacing:.1em">SECOND BROWSER WINDOW: ' + base.replace(/^https?:\/\//, "") + '/#/stream</div>' +
            '<div style="width:880px;height:495px;border:2px solid #3a4150;border-radius:10px;overflow:hidden;background:conic-gradient(#3b4252 25%,#2a303c 0 50%,#3b4252 0 75%,#2a303c 0) 0 0/40px 40px"><iframe src="' + base + '/#/stream" style="width:100%;height:100%;border:0;background:transparent" allowtransparency="true"></iframe></div>';
          document.documentElement.appendChild(d);
        }, h.BASE);
        await h.sleep(2);
      }, minHold: 6 },
    { caption: "8. In OBS: Sources, plus, Browser. Paste the address.", say: "In O B S, add a Browser source. Paste the address and match the canvas size.",
      run: async (h) => { await hideCard(h); await showCard(h, { kicker: "In OBS (explainer, OBS is not recorded)", title: "Add Vifug as a Browser source",
        items: ["Sources, then +, then <b>Browser</b>.", "Paste the stream URL from Settings, Streaming &amp; output, Stream / OBS source.", "Set <b>Width</b> and <b>Height</b> to match the canvas you chose.", "Leave the background transparent. Do not tick <b>Shutdown source when not visible</b>."] }); } },
    { caption: "9. Keep the source above your camera in the list.", say: "Keep it above your camera in the list, or the lyrics are hidden.",
      run: async (h) => { await showCard(h, { kicker: "In OBS (explainer)", title: "If your lyrics have vanished",
        items: ["O B S draws the Sources list top-down.", "The Vifug browser source must sit <b>above</b> your camera or capture card.", "Anything above covers what is below it."] }); } },
    { caption: "10. Or use Teleport to OBS: it adds the source for you.", say: "Or use Teleport. Turn on the O B S Web Socket server, then click Teleport to O B S.",
      run: async (h) => { await showCard(h, { kicker: "Teleport to OBS (explainer)", title: "Needs OBS 28 or newer, no plugin",
        items: ["In OBS: <b>Tools, WebSocket Server Settings, Enable WebSocket server</b>. Note the port (4455 by default) and any password.", "In Vifug the host is normally <b>127.0.0.1</b>. Paste the password if you set one.", "Click <b>Teleport to OBS</b>. It adds a Browser Source named \"Vifug\" to the scene on program."] }); } },
    { caption: "11. vMix: Web Controller on, then Teleport to vMix.", say: "In v Mix, the Web Controller is on by default. Enter host and port, then Teleport to v Mix.",
      run: async (h) => { await showCard(h, { kicker: "Teleport to vMix (explainer)", title: "Web Controller is on by default",
        items: ["vMix's Web Controller uses port <b>8088</b>. Nothing to turn on for most setups.", "Fill in host and port, then click <b>Teleport to vMix</b>.", "Vifug adds a Web Browser input pointing at the live overlay.", "A message means \"sent\". Check vMix's input list to see it land."] }); } },
    { caption: "Once it is in, it stays live with Go Live, Blank and Clear.", say: "Once it is in, it stays live as you go live, blank or clear.",
      run: async (h) => { await hideCard(h); await h.sleep(0.5); }, minHold: 3 },
  ],
};
