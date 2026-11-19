const path = require("path");
const L = require("./_s4211.cjs");
const logo = path.join(__dirname, "_church-logo.png");
module.exports = {
  name: "overlays-timer-ticker-logo",
  async setup(h) { await h.goto("/"); },
  steps: [
    { caption: "Timer, announcement and logo on the live screen",
      say: "Timer, announcement and logo on the live screen. Here is a song already live.",
      run: async (h) => { await L.openSongLive(h, "amazing", "Amazing Grace!", "Amazing grace! how sweet the sound!"); } },
    { caption: "1. In the Timer panel, press Off so it reads On.",
      say: "One. In the Timer panel, press Off, so it reads On.",
      run: async (h) => { await h.page.getByText("Timer", { exact: true }).first().scrollIntoViewIfNeeded(); await h.click(h.page.getByLabel("Countdown timer")); } },
    { caption: "2. Press 10m, then tick Main screen.",
      say: "Two. Press ten minutes, then tick Main screen, so the live screen shows it.",
      run: async (h) => { await h.click(h.page.getByRole("button", { name: "10m", exact: true })); await h.click(h.page.getByRole("button", { name: "Main screen", exact: true })); } },
    { caption: "3. Press Start.",
      say: "Three. Press Start.",
      run: async (h) => { await h.click(h.page.getByRole("button", { name: "Start", exact: true })); } },
    { caption: "The live screen now shows the countdown over the song.",
      say: "The live screen now shows the countdown over the song, and it stays while slides change.",
      run: async (h) => { await L.showLive(h, "THE LIVE SCREEN"); }, minHold: 4 },
    { caption: "4. Settings, General, Announcement ticker: switch it on.",
      say: "Four. For a notice, open Settings, then General, and find Announcement ticker. Switch it on.",
      run: async (h) => {
        await L.hideLive(h);
        await h.click(h.page.getByText("Settings", { exact: true }).first());
        await h.click(h.page.getByText("General", { exact: true }).first());
        await h.page.getByText("Announcement ticker").first().scrollIntoViewIfNeeded(); await h.sleep(0.4);
        await h.click(h.page.getByText("Scroll a message across").first());
      } },
    { caption: "5. Type your message. It starts scrolling straight away.",
      say: "Five. Type your message in the Message box. It starts scrolling straight away.",
      run: async (h) => { await L.typeSafe(h, h.page.getByPlaceholder(/Potluck lunch/), "Lunch in the hall after the service - everyone welcome"); } },
    { caption: "6. Logo: switch it on and choose an image.",
      say: "Six. For your logo, scroll to Logo. Switch it on, then press Upload logo and choose your picture.",
      run: async (h) => {
        const card = h.page.locator("div").filter({ hasText: /^Logo/ }).first();
        await h.page.getByText("Show a logo in a corner").first().scrollIntoViewIfNeeded(); await h.sleep(0.4);
        await h.click(h.page.getByText("Show a logo in a corner").first());
        await h.page.locator('input[type=file]').first().setInputFiles(logo);
        await h.glide(640, 511); await h.sleep(2.0);
      }, minHold: 4 },
    { caption: "7. Pick the corner and size. Top left keeps clear of the timer.",
      say: "Seven. Choose the corner and the size. Top left keeps the logo clear of the timer.",
      run: async (h) => { await h.click(h.page.getByRole("button", { name: "Top left", exact: true }).first()); } },
    { caption: "Close Settings: logo, timer and announcement over the song.",
      say: "Close Settings. The logo, the timer and the announcement all sit over the song.",
      run: async (h) => { await h.click(h.page.getByRole("button", { name: "Done" })); await L.showLive(h, "THE LIVE SCREEN"); }, minHold: 5 },
    { caption: "Switch each one off when it has done its job.",
      say: "Switch each one off when it has done its job, so people do not learn to ignore it.",
      run: async (h) => { await h.sleep(1); } },
  ],
};
