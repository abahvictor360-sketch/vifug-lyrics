const { showCard, hideCard } = require("./_cards-bullets.cjs");
const { installDesktopStub } = require("./_desktop-stub.cjs");
const point = async (h, loc) => { const b = await loc.boundingBox(); await h.glide(b.x + b.width / 2, b.y + b.height / 2, 800); };
module.exports = {
  name: "staying-up-to-date",
  async setup(h) { await installDesktopStub(h, "1.36.0"); await h.goto("/"); },
  steps: [
    { caption: "Staying up to date", say: "Staying up to date.",
      run: async (h) => { await h.glide(640, 300, 800); } },
    { caption: "1. The desktop app checks for a new version when it starts.", say: "The desktop app quietly checks for a newer version each time it starts. If there is one, you get a prompt. If not, you hear nothing.",
      run: async (h) => { await showCard(h, { kicker: "Desktop app", title: "It checks on launch",
        lines: ["When the app starts it quietly asks whether anything newer has been published.", "If there is, you get a prompt. If there is not, you get nothing.", "The check needs a moment of internet, and that is all the internet is used for."] }); }, minHold: 9 },
    { caption: "2. The prompt lists the release notes, so you can decide.", say: "The prompt lists the actual release notes, so you can see whether it is a fix you have been waiting for, or a small change that can wait.",
      run: async (h) => { await showCard(h, { kicker: "Desktop app", title: "It shows what changed",
        lines: ["Remind Me Later closes the prompt, and leaves a small Update pill in the header.", "Skip Version hides that pill too, for that release, until something newer ships."] }); }, minHold: 9 },
    { caption: "3. Or ask any time: Help, then Check for updates.", say: "You can also ask whenever you like. Open the Help menu and choose Check for updates.",
      run: async (h) => { await hideCard(h); await h.click(h.page.getByRole("button", { name: /^Help/ })); await h.sleep(0.6);
        await point(h, h.page.getByRole("button", { name: /Check for updates/ })); }, minHold: 6 },
    { caption: "A check you ask for always gives an answer.", say: "A check you ask for always gives an answer, even when you are already on the newest version. Silence would just look broken.",
      run: async (h) => { await h.sleep(0.5); }, minHold: 6 },
    { caption: "4. Your version is in Settings, then About.", say: "To see which version you are on, open Settings, then About. The version number is shown next to the name.",
      run: async (h) => { await h.page.keyboard.press("Escape"); await h.sleep(0.4);
        await h.click(h.page.getByRole("button", { name: /Settings/ }).first()); await h.click(h.page.getByRole("button", { name: /^About/ }));
        await h.sleep(0.5); await point(h, h.page.getByText(/^v\d+\.\d+\.\d+/).first()); }, minHold: 6 },
    { caption: "Update on a weekday, not five minutes before the service.", say: "Update on a weekday, not five minutes before the service. Installing keeps your songs, settings and imported decks where they are.",
      run: async (h) => { await showCard(h, { kicker: "A good habit", title: "Give yourself time to look",
        lines: ["Installing replaces the app. Your songs, settings and imported decks stay where they are.", "If the machine is permanently offline, the app carries on exactly as it is.", "Nothing expires and nothing stops working."] }); }, minHold: 9 },
    { caption: "Vifug tells you about new versions, and shows what changed.", say: "Vifug tells you when there is a new version, and shows you what changed before you decide.",
      run: async (h) => { await hideCard(h); await h.click(h.page.getByText("Done", { exact: true })); } },
  ],
};
