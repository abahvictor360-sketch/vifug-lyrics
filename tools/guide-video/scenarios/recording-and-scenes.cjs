const L = require("./_s4211.cjs");
const C = require("./_cards.cjs");
module.exports = {
  name: "recording-and-scenes",
  async setup(h) { await L.fakeCamera(h); await h.goto("/"); },
  steps: [
    { caption: "Recording the service, and saving scenes",
      say: "Recording the service, and saving camera scenes.",
      run: async (h) => { await h.sleep(0.5); } },
    { caption: "1. Under the Live picture is a Record button. F10 does the same.",
      say: "One. Under the Live picture is a Record button, and it shows its shortcut, F ten.",
      run: async (h) => {
        const b = h.page.getByRole("button", { name: /Record/ }).first();
        await b.scrollIntoViewIfNeeded(); await h.sleep(0.4);
        const bb = await b.boundingBox();
        await h.glide(bb.x + bb.width / 2, bb.y + bb.height / 2, 800);
      }, minHold: 4 },
    { caption: "2. Settings, Shortcuts: the key for Start / stop recording.",
      say: "Two. In Settings, then Shortcuts, the action is called Start or stop recording.",
      run: async (h) => {
        await h.click(h.page.getByRole("button", { name: "Settings" }).first());
        await h.click(h.page.getByText("Shortcuts", { exact: true }).first());
        await h.sleep(0.8);
        const r = h.page.getByText("Start / stop recording").first();
        await r.scrollIntoViewIfNeeded(); await h.sleep(0.5);
        const bb = await r.boundingBox(); await h.glide(bb.x + 40, bb.y + 10, 600);
      }, minHold: 4 },
    { caption: "3. In this browser, Record says: Recording needs the desktop app.",
      say: "Three. Recording is part of the desktop app. In a browser, the Record button says so.",
      run: async (h) => {
        await h.click(h.page.getByRole("button", { name: "Done", exact: true }));
        await h.click(h.page.getByRole("button", { name: /Record/ }).first());
        await h.page.getByText("Recording needs the desktop app.", { exact: true }).waitFor({ timeout: 5000 });
        await h.sleep(0.8);
      }, minHold: 4 },
    { caption: "The status line at the bottom shows REC. It switches on while recording.",
      say: "The status line at the bottom has a REC indicator. It reads off now, and switches on while recording.",
      run: async (h) => {
        const r = h.page.getByText(/^REC /).first();
        const bb = await r.boundingBox(); await h.glide(bb.x + bb.width / 2, bb.y - 6, 800);
      }, minHold: 5 },
    { caption: "In the desktop app: the button turns red and counts the time. REC switches on.",
      say: "In the desktop app, you put something live and press Record or F ten. The button turns red and counts the time, and REC switches on.",
      run: async (h) => {
        await C.showCard(h, { kicker: "In the desktop app", title: "Record the service", items: [
          "Put something live. The live output is what gets recorded.",
          "Press <b>Record</b> under the Live picture, or <b>F10</b>.",
          "The button turns red and counts the time: <b>Stop recording 00:42</b>. <b>REC</b> switches on in the status line.",
          "Press <b>Stop recording</b>. Vifug shows <b>Saving&hellip;</b>, then <b>Saved</b>, with the file name and folder."] });
      } },
    { caption: "The file is silent WebM, saved in the Recordings folder.",
      say: "The file has no sound. It is a WebM video, saved in a Recordings folder next to your Media folder.",
      run: async (h) => {
        await C.showCard(h, { kicker: "Where it goes", title: "What you get", items: [
          "A silent video: <b>no sound</b> in the file.",
          "A <b>WebM</b> file, which plays in a browser or in VLC.",
          "Saved in a <b>Recordings</b> folder next to your Media folder."] });
      } },
    { caption: "4. Media, Capture: choose a camera so it is cued.",
      say: "Four. Scenes save a camera set-up under a name. Go to Media, then Capture, and choose a camera.",
      run: async (h) => {
        await C.hideCard(h);
        await h.click(h.page.getByText("Media", { exact: true }).first());
        await h.click(h.page.getByText("Capture", { exact: true }).first());
        await h.click(h.page.getByText("Choose source").first());
        await h.click(h.page.getByText("Test camera").first());
        await h.sleep(1.0);
        await h.page.mouse.move(640, 400); await h.page.mouse.wheel(0, 600); await h.sleep(0.5);
        await h.click(h.page.getByRole("button", { name: "Cue to Preview" }));
        await h.sleep(1.0);
        // keep the caption clear of the Scenes and Layout controls on the left
        await h.page.evaluate(() => { const c = document.getElementById("vf-cap"); c.style.bottom = "auto"; c.style.top = "100px"; c.style.left = "26%"; c.style.maxWidth = "480px"; c.style.fontSize = "18px"; });
      }, minHold: 4 },
    { caption: "5. Set the layout to Video only.",
      say: "Five. Set the layout. Here it is Video only.",
      run: async (h) => {
        const b = h.page.getByRole("button", { name: "Video only", exact: true });
        await h.page.mouse.move(380, 400); await h.sleep(0.1);
        await h.click(b); await h.sleep(0.8);
      }, minHold: 3 },
    { caption: "6. Under Scenes, Save current set-up as a scene. Name it Wide shot.",
      say: "Six. Under Scenes, press Save current set-up as a scene, type a name, and press Enter.",
      run: async (h) => {
        const s = h.page.getByRole("button", { name: /Save current set-up as a scene/ });
        await h.click(s);
        await L.typeSafe(h, h.page.getByPlaceholder(/Scene name/), "Wide shot", 70);
        await h.press("Enter", 0.8);
      }, minHold: 4 },
    { caption: "7. Change the layout to Side by side and save a second scene: Interview.",
      say: "Seven. Change the layout to Side by side, and save a second scene called Interview.",
      run: async (h) => {
        const b = h.page.getByRole("button", { name: "Side by side", exact: true });
        await h.page.mouse.move(380, 400); await h.sleep(0.1);
        await h.click(b); await h.sleep(0.8);
        const s = h.page.getByRole("button", { name: /Save current set-up as a scene/ });
        await h.page.mouse.move(380, 400); await h.page.mouse.wheel(0, -600); await h.sleep(0.6);
        await h.click(s);
        await L.typeSafe(h, h.page.getByPlaceholder(/Scene name/), "Interview", 70);
        await h.press("Enter", 0.8);
      }, minHold: 5 },
    { caption: "8. Press a scene's button to bring it back. It is cued to Preview.",
      say: "Eight. Press a scene's button to bring it back. With nothing on air, it is cued to Preview.",
      run: async (h) => {
        await h.page.mouse.move(380, 400); await h.page.mouse.wheel(0, -600); await h.sleep(0.6);
        await h.click(h.page.getByRole("button", { name: "Wide shot", exact: true }).first()); await h.sleep(1.4);
        await h.click(h.page.getByRole("button", { name: "Interview", exact: true }).first()); await h.sleep(1.4);
      }, minHold: 5 },
    { caption: "The small x beside a scene deletes it. Scenes stay on this computer.",
      say: "The small cross beside a scene deletes it. Scenes are kept on the computer you made them on.",
      run: async (h) => {
        const x = h.page.getByRole("button", { name: "Delete scene Interview" });
        const bb = await x.boundingBox(); await h.glide(bb.x + bb.width / 2, bb.y + bb.height / 2, 800);
      }, minHold: 5 },
  ],
};
