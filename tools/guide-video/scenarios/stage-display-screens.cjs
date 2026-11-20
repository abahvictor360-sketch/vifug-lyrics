const L = require("./_s4211.cjs");
module.exports = {
  name: "stage-display-screens",
  async setup(h) { await h.goto("/"); },
  steps: [
    { caption: "Every screen, always in sync",
      say: "Every screen, always in sync. Here is a song, live.",
      run: async (h) => { await L.openSongLive(h, "amazing", "Amazing Grace!", "Amazing grace! how sweet the sound!"); } },
    { caption: "1. Settings, Streaming & output: every screen has its own address.",
      say: "One. Open Settings, then Streaming and output. Under Outputs and companion screens, each screen has its own address, including the stage display.",
      run: async (h) => {
        await h.click(h.page.getByText("Settings", { exact: true }).first());
        await h.click(h.page.getByText("Streaming & output", { exact: true }).first());
        await h.sleep(1.0);
        await L.scrollTo(h, h.page.getByText("Outputs & companion screens").first(), 130);
        await h.sleep(1.5);
      }, minHold: 7 },
    { caption: "2. Type notes for the stage display.",
      say: "Two. Type notes for the band. They show on the stage display.",
      run: async (h) => {
        const ta = h.page.getByPlaceholder(/Key of G/);
        await L.typeSafe(h, ta, "Key of G - repeat the chorus", 70);
      } },
    { caption: "3. The stage display: this slide, the next one, the clock and your notes.",
      say: "Three. Open the stage address on a screen facing the team. It shows the current slide, the next slide, the clock and your notes.",
      run: async (h) => {
        await h.page.evaluate(() => document.activeElement && document.activeElement.blur());
        await h.click(h.page.getByRole("button", { name: "Done", exact: true }));
        await L.showPair(h, [{ label: "THE MAIN SCREEN", src: "/#/projector" }, { label: "THE STAGE DISPLAY", src: "/#/stage" }], "Key of G");
      }, minHold: 7 },
    { caption: "4. Press Next. Every screen follows at once.",
      say: "Four. Press Next. Every screen follows at once.",
      run: async (h) => {
        await h.sleep(0.8);
        await h.page.keyboard.press("ArrowRight"); await h.sleep(1.5);
      }, minHold: 4 },
    { caption: "5. Settings, Streaming & output, Extra screens: Add a screen.",
      say: "Five. A second screen can show something different. Under Extra screens, press Add a screen.",
      run: async (h) => {
        await L.hideLive(h);
        await h.click(h.page.getByText("Settings", { exact: true }).first());
        await h.click(h.page.getByText("Streaming & output", { exact: true }).first());
        await h.sleep(1.0);
        await L.scrollTo(h, h.page.getByRole("button", { name: /Add a screen/ }), 380);
        await L.clickStable(h, h.page.getByRole("button", { name: /Add a screen/ }));
        await h.sleep(0.8);
      }, minHold: 5 },
    { caption: "6. Settings, Lyrics, Theme for each screen: pick a theme for it.",
      say: "Six. Then under Lyrics, Theme for each screen, pick a theme for that screen.",
      run: async (h) => {
        await h.click(h.page.getByText("Theme, background & fonts"));
        await h.sleep(1.0);
        const lab = h.page.locator("label", { hasText: "Screen 2" }).first();
        await L.scrollTo(h, lab, 300);
        const sel = lab.locator("select");
        await h.click(sel);
        await sel.selectOption({ label: "Navy Blue" });
        await h.sleep(1.0);
      }, minHold: 6 },
    { caption: "Every screen follows the live slide, each with its own look.",
      say: "Every screen follows the live slide, each with its own look.",
      run: async (h) => { await h.sleep(1); } },
  ],
};
