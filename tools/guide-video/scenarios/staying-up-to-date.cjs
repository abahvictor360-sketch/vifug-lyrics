const { showCard, hideCard } = require("./_cards-bullets.cjs");
module.exports = {
  name: "staying-up-to-date",
  async setup(h) { await h.goto("/"); },
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
      run: async (h) => { await hideCard(h); await h.click(h.page.getByText("Help", { exact: true }).first()); await h.sleep(1.2); }, minHold: 5 },
    { caption: "A deliberate check always gives an answer. Here, in a browser, it says so.", say: "A check you ask for always gives an answer. In this browser version, it tells you checking is only for the installed desktop app.",
      run: async (h) => { await h.click(h.page.getByRole("button", { name: /Check for updates/ })); await h.sleep(1.5); }, minHold: 7 },
    { caption: "4. The desktop app shows your version in Settings, then About.", say: "To see which version you are on, open Settings, then About. The desktop app shows the number there.",
      run: async (h) => { await h.page.keyboard.press("Escape"); await h.sleep(0.4);
        const close = h.page.getByRole("button", { name: /^(Close|Done|OK|Dismiss)/ }); if (await close.count()) await h.click(close.first());
        await h.click(h.page.getByRole("button", { name: /Settings/ }).first()); await h.click(h.page.getByRole("button", { name: /^About/ })); }, minHold: 5 },
    { caption: "Update on a weekday, not five minutes before the service.", say: "Update on a weekday, not five minutes before the service. Installing keeps your songs, settings and imported decks where they are.",
      run: async (h) => { await showCard(h, { kicker: "A good habit", title: "Give yourself time to look",
        lines: ["Installing replaces the app. Your songs, settings and imported decks stay where they are.", "If the machine is permanently offline, the app carries on exactly as it is.", "Nothing expires and nothing stops working."] }); }, minHold: 9 },
    { caption: "Vifug tells you about new versions, and shows what changed.", say: "Vifug tells you when there is a new version, and shows you what changed before you decide.",
      run: async (h) => { await hideCard(h); await h.click(h.page.getByText("Done", { exact: true })); } },
  ],
};
