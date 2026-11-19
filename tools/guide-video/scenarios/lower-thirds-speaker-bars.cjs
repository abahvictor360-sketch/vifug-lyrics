const L = require("./_s4211.cjs");
module.exports = {
  name: "lower-thirds-speaker-bars",
  async setup(h) { await L.fakeCamera(h); await h.goto("/"); },
  steps: [
    { caption: "Lower thirds and speaker name bars",
      say: "Lower thirds and speaker name bars. Design one, then put it on air.",
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
        await h.glide(hx + 170, hy, 900); await h.page.mouse.up(); await h.sleep(0.6);
      } },
    { caption: "4. Under Colours, adjust the bar. It saves as you go.",
      say: "Four. Under Colours, Bar behind the words sets the bar. Everything saves as you go.",
      run: async (h) => {
        await h.page.getByText("Bar behind the words").first().scrollIntoViewIfNeeded(); await h.sleep(0.6);
        const sl = h.page.locator('label:has-text("Rounded corners") input[type=range]').first();
        const b = await sl.boundingBox();
        if (b) await h.click(sl, { fx: 0.8 });
        await h.sleep(0.6);
      } },
    { caption: "5. Media, Capture: choose the camera and cue it.",
      say: "Five. To use it, go to Media, then Capture. Choose your camera and cue it.",
      run: async (h) => {
        await h.click(h.page.getByRole("button", { name: "Done", exact: true }));
        await h.click(h.page.getByText("Media", { exact: true }).first());
        await h.click(h.page.getByText("Capture", { exact: true }).first());
        await h.click(h.page.getByText("Choose source").first());
        await h.click(h.page.getByText("Test camera").first());
        await h.sleep(1.5);
        await h.page.mouse.move(640, 400); await h.page.mouse.wheel(0, 600); await h.sleep(0.5);
        await h.click(h.page.getByRole("button", { name: "Cue to Preview" }));
      }, minHold: 3 },
    { caption: "6. Press Go Live.",
      say: "Six. Press Go Live.",
      run: async (h) => { await h.click(h.page.getByRole("button", { name: /GO LIVE/i })); await h.sleep(1.0); } },
    { caption: "7. Preacher nameplate: type the name and title, then pick My design.",
      say: "Seven. Under Preacher nameplate, type the name and the title, then choose your theme in My design.",
      run: async (h) => {
        await h.page.getByPlaceholder("Name", { exact: true }).scrollIntoViewIfNeeded(); await h.sleep(0.4);
        await L.typeSafe(h, h.page.getByPlaceholder("Name", { exact: true }), "Pastor John Adeyemi", 70);
        await L.typeSafe(h, h.page.getByPlaceholder(/Title \(optional/), "Senior Pastor", 70);
        await h.click(h.page.locator("select").filter({ hasText: "Use a built-in style" }));
        const sel = h.page.locator("select").filter({ hasText: "Use a built-in style" });
        const val = await sel.evaluate((e) => { const o = [...e.options].find((x) => /New theme/.test(x.text)); return o ? o.value : ""; });
        await sel.selectOption(val);
        await h.sleep(0.8);
      }, minHold: 4 },
    { caption: "The Live panel shows the name bar over the camera, in your design.",
      say: "The Live panel shows the name bar over the camera, in your design.",
      run: async (h) => {
        await h.page.evaluate(() => {
          const el = [...document.querySelectorAll("div")].find((d) => { const r = d.getBoundingClientRect(); return r.width > 220 && r.width < 250 && r.height > 150 && r.height < 175 && r.left > 1000 && r.top < 100; });
          if (el) { el.id = "vf-livecard"; el.style.cssText += ";transform:scale(2.6);transform-origin:top right;position:relative;z-index:2147483000;box-shadow:0 10px 40px rgba(0,0,0,.7)"; }
        });
        await h.sleep(2.5);
      }, minHold: 4 },
    { caption: "8. Settings, Streaming & output: choose Lower third over the camera.",
      say: "Eight. For people watching online, open Settings, then Streaming and output, and choose Lower third over the camera. The room is not changed.",
      run: async (h) => {
        await h.page.evaluate(() => { const e = document.getElementById("vf-livecard"); if (e) e.style.transform = "none"; });
        await h.click(h.page.getByText("Settings", { exact: true }).first());
        await h.click(h.page.getByText("Streaming & output", { exact: true }).first());
        await h.page.getByText("What the online audience sees").first().scrollIntoViewIfNeeded(); await h.sleep(0.5);
        await h.click(h.page.getByText("Lower third over the camera").first());
        await h.sleep(1.0);
      }, minHold: 6 },
    { caption: "9. Go live with a song: full display in the room, lower third online.",
      say: "Nine. Go live with a song. The room sees the full display, and the stream carries the words as a lower third.",
      run: async (h) => {
        await h.click(h.page.getByRole("button", { name: "Done", exact: true }));
        await h.click(h.page.getByRole("button", { name: "Clear", exact: true }));
        await h.click(h.page.getByText("Lyrics", { exact: true }).first());
        await L.openSongLive(h, "amazing", "Amazing Grace!", "Amazing grace! how sweet the sound!");
        await L.showRoomAndStream(h);
      }, minHold: 5 },
  ],
};
