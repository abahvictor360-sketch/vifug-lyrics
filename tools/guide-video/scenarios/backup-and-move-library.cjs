const { showCard, hideCard } = require("./_cards-bullets.cjs");
const { installDesktopStub } = require("./_desktop-stub.cjs");
const settingsBtn = (h) => h.page.getByRole("button", { name: /Settings/ }).first();
const btn = (h, re) => h.page.getByRole("button", { name: re });
// Point at a control without pressing it: the backup, restore and import actions belong to the desktop app and are never run here.
const point = async (h, loc) => { const b = await loc.boundingBox(); await h.glide(b.x + b.width / 2, b.y + b.height / 2, 800); };
module.exports = {
  name: "backup-and-move-library",
  async setup(h) { await installDesktopStub(h, "1.36.0"); await h.goto("/"); },
  steps: [
    { caption: "Back up, restore and move your library", say: "Back up, restore and move your library.",
      run: async (h) => { await h.glide(640, 300, 800); } },
    { caption: "1. Backup lives in Settings, then General.", say: "Backup lives in Settings, then General. Scroll to the bottom and you find the Backup group.",
      run: async (h) => { await h.click(settingsBtn(h)); await h.click(btn(h, /^General/)); await h.sleep(0.6);
        await h.page.mouse.move(780, 400); for (let i = 0; i < 8; i++) { await h.page.mouse.wheel(0, 420); await h.sleep(0.4); } }, minHold: 7 },
    { caption: "2. Back up now copies your library and media to a dated folder.", say: "Back up now copies your songs, presentations, settings and media into a dated folder. Choose a USB stick, an external drive or a synced folder.",
      run: async (h) => { await point(h, btn(h, /Back up now/)); }, minHold: 8 },
    { caption: "The folder is named Vifug-Backup, then the date and time.", say: "Vifug makes a folder called Vifug-Backup, followed by the date and time. Keep what is inside together, because that folder is what Import and Restore ask for.",
      run: async (h) => { await showCard(h, { kicker: "Desktop app, Settings, General, Backup", title: "What Back up now creates",
        lines: ["A new folder named Vifug-Backup- followed by the date and time.", "Inside: vifug.db with every song, presentation, theme, font, plan and setting, and a Media folder.", "Keep the two together. The folder is what Import and Restore ask for."] }); }, minHold: 9 },
    { caption: "3. Import from another Vifug adds songs and media to this library.", say: "To move songs to another computer, back up there, carry the folder across, then press Import from another Vifug, and choose the Vifug-Backup folder itself.",
      run: async (h) => { await hideCard(h); await point(h, btn(h, /Import from another Vifug/)); }, minHold: 9 },
    { caption: "Import never replaces anything, and repeating it is safe.", say: "Import adds what is missing: songs, presentations, media, themes and fonts. Nothing already here is replaced, and nothing is added twice, so importing the same folder again adds nothing.",
      run: async (h) => { await h.glide(560, 497, 900); await h.sleep(0.4); await h.glide(1000, 509, 1200); }, minHold: 10 },
    { caption: "4. Restore from backup replaces this library, so back up first.", say: "Restore from backup replaces every song, presentation and setting with the backup's, and restarts the app. Anything added since is lost, so back up first if in doubt.",
      run: async (h) => { await point(h, btn(h, /Restore from backup/)); }, minHold: 9 },
    { caption: "5. To add single songs, use Import in the library.", say: "To add single songs, press Import in the library. You can choose ProPresenter files, text files or Word documents.",
      run: async (h) => { await h.click(h.page.getByText("Done", { exact: true })); await h.click(btn(h, /^Import/)); await h.sleep(0.5); await h.glide(336, 232, 900); }, minHold: 6 },
    { caption: "Back up before anything risky, and regularly.", say: "Back up before anything risky, and regularly.",
      run: async (h) => { await h.click(btn(h, "Cancel")); } },
  ],
};
