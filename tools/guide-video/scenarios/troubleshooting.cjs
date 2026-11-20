const { showCard, hideCard } = require("./_cards-obs-ts.cjs");
async function scrollTo(h, text) {
  await h.page.getByText(text, { exact: true }).first().evaluate((e) => e.scrollIntoView({ block: "start", behavior: "smooth" }));
  await h.sleep(0.9);
}
module.exports = {
  name: "troubleshooting",
  async setup(h) { await h.goto("/"); },
  steps: [
    { caption: "When something is not working", say: "When something is not working on Sunday morning.", minHold: 3 },
    { caption: "1. No picture on the projector? Read the line under Preview and Live.", say: "No picture on the projector? Read the line under the Preview and Live pictures.",
      run: async (h) => { await h.glide(900, 244, 900); await h.sleep(0.5); } },
    { caption: "It says Projecting on a screen, No second screen, or Output closed.", say: "It says Projecting on a screen, No second screen connected, or Output closed.",
      run: async (h) => { await h.glide(830, 244, 500); await h.glide(1010, 244, 700); } },
    { caption: "2. Plug the screen in. Vifug uses it straight away.", say: "Plug the projector in and Vifug uses it straight away. With several screens, right-click Preview or Live to choose.",
      run: async (h) => { await showCard(h, { kicker: "Needs a second screen (explainer)", title: "No second screen connected",
        items: ["A projector or TV plugged into the machine gets the output <b>automatically</b>, full screen.", "With only <b>one display</b>, Vifug leaves it alone so the output never covers your controls.", "With several screens, <b>right-click Preview or Live</b> and pick one by name. If you close the output yourself, it stays closed until you project again, or plug a screen in or out."] }); }, minHold: 7 },
    { caption: "3. No sound? First, check which speakers Vifug plays through.", say: "No sound has two separate causes. First, where it comes out. Open Settings, then General.",
      run: async (h) => { await hideCard(h); await h.click(h.page.getByRole("button", { name: "Settings" }).first()); await h.click(h.page.getByText("Projector & live behavior", { exact: true })); } },
    { caption: "Settings, General, Sound output: pick the PA speakers and press Test.", say: "Under Sound output, pick the device the P A is on. Test plays a short tone.",
      run: async (h) => { await h.page.getByText("The speakers, sound card or HDMI output").first().evaluate((e) => { e.scrollIntoView({ block: "start" }); let p = e.parentElement; while (p && p.scrollHeight <= p.clientHeight + 5) p = p.parentElement; if (p) p.scrollTop -= 90; }); await h.sleep(0.9); await h.glide(1130, 120, 700); await h.sleep(0.3); await h.glide(640, 330, 800); await h.sleep(0.5); } },
    { caption: "4. In the Audio Mixer, Sound output mutes everything at once.", say: "The Audio Mixer's Sound output button silences everything. Press it again to restore it.",
      run: async (h) => {
        await h.click(h.page.getByRole("button", { name: "Done", exact: true }));
        const btn = h.page.locator('button[title*="Mute everything the app plays"], button[title*="Unmute the app"]').first();
        await h.page.evaluate(() => { const c = document.getElementById("vf-cap"); c.style.cssText += ";left:27%;max-width:440px;top:300px;bottom:auto"; });
        await btn.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "smooth" })); await h.sleep(0.9);
        await h.click(btn, { after: 1.4 }); await h.click(btn, { after: 0.8 });
      }, minHold: 7 },
    { caption: "The second reason: the clip itself. Sound on or Silent.", say: "Second, the clip itself: Sound on or Silent in the Media tab. An unclicked projector window starts muted.",
      run: async (h) => { await h.page.evaluate(() => { const c = document.getElementById("vf-cap"); c.style.left = "50%"; c.style.maxWidth = "1000px"; c.style.top = "auto"; c.style.bottom = "28px"; }); await showCard(h, { kicker: "Per-video sound (explainer)", title: "Is the clip silent, or is the window muted?",
        items: ["Select the video in the <b>Media</b> tab. Its properties panel has <b>Sound on / Silent</b>. A loop behind lyrics is usually silent.", "A projector window nobody has clicked in starts muted. <b>Click it once</b>.", "Only one screen makes the noise, so you will not hear an echo from several copies."] }); }, minHold: 7 },
    { caption: "5. Lyrics missing in OBS? The source must sit above the camera.", say: "Lyrics gone in O B S? Put the Vifug source above your camera. Streaming to platforms needs the desktop app.",
      run: async (h) => { await showCard(h, { kicker: "Streaming (explainer)", title: "Lyrics gone, or stream will not go out",
        items: ["O B S draws top-down. Put the Vifug browser source <b>above</b> your camera or capture card.", "Leave the background transparent. Do not tick <b>Shutdown source when not visible</b>.", "Streaming to platforms from Vifug needs the <b>desktop app</b>. In a browser, use the OBS overlay.", "Run a private test before Sunday: unlisted, or Only me."] }); }, minHold: 7 },
    { caption: "6. Phone or stage display will not load? The Windows firewall.", say: "Phone or stage display will not load? Usually the Windows firewall. Press Allow through the firewall, and use the phone's own Wi-Fi.",
      run: async (h) => { await showCard(h, { kicker: "Windows desktop app (explainer)", title: "Other devices cannot connect",
        items: ["Settings, <b>Streaming &amp; output</b>, <b>On another device (same Wi-Fi)</b>.", "An amber panel says Windows Firewall has no rule for Vifug. Press <b>Allow through the firewall</b> and accept the administrator prompt.", "Then type one of the listed addresses into the phone's browser. Use the one on the phone's own Wi-Fi, not guest Wi-Fi.", "Still failing? Router <b>client isolation</b> or other security software can block it."] }); }, minHold: 9 },
    { caption: "Read the status line, check the sound, then the network.", say: "Status line, then sound, then network.",
      run: async (h) => { await hideCard(h); await h.sleep(0.5); }, minHold: 3 },
  ],
};
