const L = require("./_s4211.cjs");
module.exports = {
  name: "lower-thirds-speaker-bars",
  async setup(h) { await L.fakeCamera(h); await h.goto("/"); },
  steps: [
    { caption: "Lower thirds and speaker name bars",
      say: "Lower thirds and speaker name bars.",
      run: async (h) => { await h.sleep(0.5); } },
    { caption: "1. Settings, Theme designer. Press New.",
      say: "One. Open Settings, then Theme designer, and press New.",
      run: async (h) => {
        await h.click(h.page.getByText("Settings", { exact: true }).first());
        await h.click(h.page.getByText("Theme designer", { exact: true }).first());
        await h.click(h.page.locator('button[title^="Start a new theme"]'));
      } },
    { caption: "2. Set For to Speaker name (lower third).",
      say: "Two. Set For to Speaker name, lower third. The sample becomes a name and title on a bar.",
      run: async (h) => {
        await h.click(h.page.locator("select").nth(2));
        await h.page.locator("select").nth(2).selectOption("speaker"); await h.sleep(1.0);
      } },
    { caption: "3. The text box is the bar. Drag its edge to size it.",
      say: "Three. The text box is the bar. Drag its edge to make it the size you want.",
      run: async (h) => {
        const hb = await h.page.locator('[data-handle="e"]').first().boundingBox();
        const hx = hb.x + hb.width / 2, hy = hb.y + hb.height / 2;
        await h.glide(hx, hy); await h.page.mouse.down(); await h.sleep(0.15);
        await h.glide(hx + 170, hy, 600); await h.page.mouse.up(); await h.sleep(0.6);
      } },
    { caption: "4. Settings, Streaming & output: choose Lower third over the camera.",
      say: "Four. For people watching online, open Settings, then Streaming and output, and choose Lower third over the camera. The room is not changed.",
      run: async (h) => {
        await h.click(h.page.getByRole("button", { name: "Done", exact: true }));
        await h.click(h.page.getByText("Settings", { exact: true }).first());
        await h.click(h.page.getByText("Streaming & output", { exact: true }).first());
        const ch = h.page.getByText("Lower third over the camera").first();
        await h.page.mouse.move(760, 400);
        for (let i = 0; i < 8; i++) { const bb = await ch.boundingBox(); if (bb && bb.y < 520) break; await h.page.mouse.wheel(0, 140); await h.sleep(0.25); }
        await h.click(ch);
        await h.sleep(0.8);
      }, minHold: 4 },
    { caption: "5. Go live with a song: full display in the room, lower third online.",
      say: "Five. Go live with a song. The room sees the full display, and the stream carries the words as a lower third.",
      run: async (h) => {
        await h.click(h.page.getByRole("button", { name: "Done", exact: true }));
        await L.openSongLive(h, "amazing", "Amazing Grace!", "Amazing grace! how sweet the sound!");
        await L.showRoomAndStream(h);
      }, minHold: 3 },
    { caption: "6. For a name bar: Media, Capture. Choose the camera, cue it, Go Live.",
      say: "Six. For a speaker name bar, go to Media, then Capture. Choose your camera, cue it, and press Go Live.",
      run: async (h) => {
        await L.hideLive(h);
        await h.click(h.page.getByText("Media", { exact: true }).first());
        await h.click(h.page.getByText("Capture", { exact: true }).first());
        await h.click(h.page.getByText("Choose source").first());
        await h.click(h.page.getByText("Test camera").first());
        await h.sleep(1.0);
        await h.page.mouse.move(640, 400); await h.page.mouse.wheel(0, 600); await h.sleep(0.5);
        await h.click(h.page.getByRole("button", { name: "Cue to Preview" }));
        await h.click(h.page.getByRole("button", { name: /GO LIVE/i })); await L.preloadLive(h); await h.sleep(0.6);
      }, minHold: 3 },
    { caption: "7. Preacher nameplate: type the name and title, then pick My design.",
      say: "Seven. Under Preacher nameplate, type the name and the title, then choose your theme in My design.",
      run: async (h) => {
        await h.page.getByPlaceholder("Name", { exact: true }).scrollIntoViewIfNeeded(); await h.sleep(0.4);
        await L.typeSafe(h, h.page.getByPlaceholder("Name", { exact: true }), "Pastor John Adeyemi", 45);
        await L.typeSafe(h, h.page.getByPlaceholder(/Title \(optional/), "Senior Pastor", 45);
        const sel = h.page.locator("select").filter({ hasText: "Use a built-in style" });
        await h.click(sel);
        const val = await sel.evaluate((e) => { const o = [...e.options].find((x) => /New theme/.test(x.text)); return o ? o.value : ""; });
        await sel.selectOption(val);
        await h.sleep(0.8);
      }, minHold: 4 },
    { caption: "The name bar is on air over the camera, in your design.",
      say: "The name bar is on air over the camera, in your design.",
      run: async (h) => { await L.showLive(h, "THE LIVE SCREEN", "/#/projector", "Pastor"); }, minHold: 3 },
  ],
};
