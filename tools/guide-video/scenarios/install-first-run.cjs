const card = require("./_cards.cjs");
const DL = "http://localhost:4262/download.html";
module.exports = {
  name: "install-first-run",
  async setup(h) { await h.page.goto(DL, { waitUntil: "domcontentloaded" }); await h.sleep(1.2); },
  steps: [
    { caption: "Install Vifug and answer the first-run questions", say: "Installing Vifug, and answering its first-run questions.",
      run: async (h) => { await h.glide(640, 330, 500); } },
    { caption: "1. Pick the download for your system.", say: "On the download page, pick the file for your system: Windows, Mac or Linux.",
      run: async (h) => {
        await h.page.mouse.wheel(0, 140); await h.sleep(0.5);
        await h.glide(270, 480, 700); await h.sleep(0.5); await h.glide(640, 480, 600); await h.sleep(0.5); await h.glide(1010, 480, 600);
      } },
    { caption: "2. The first time you open it, your computer warns that Vifug is not signed.", say: "Vifug is not code-signed yet, so your computer warns you the first time you open it. This page has the steps for each system.",
      run: async (h) => {
        await h.page.evaluate(() => scrollTo({ top: 760, behavior: "smooth" })); await h.sleep(1.0);
        await h.click(h.page.getByRole("tab", { name: "Windows", exact: true }).first()); await h.sleep(1.2);
        await h.click(h.page.getByRole("tab", { name: "macOS", exact: true }).first()); await h.sleep(1.2);
        await h.click(h.page.getByRole("tab", { name: "Linux", exact: true }).first());
      } },
    { caption: "3. Run the installer once, then open Vifug.", say: "Run the installer once, then open Vifug. You are never asked again.", minHold: 6,
      run: async (h) => card.show(h, "Install, then open Vifug", [
        ["Windows", "Open the Setup file, choose where to install, let it finish."],
        ["macOS", "Drag Vifug into Applications, then right-click it and choose Open."],
        ["Linux", "Mark the AppImage as executable, then run it."],
      ], "325 songs and the offline Bible are already loaded. No account needed.") },
    { caption: "4. Vifug opens with a few quick questions.", say: "The first time it opens, Vifug asks a few quick questions, one to a page.",
      run: async (h) => { await card.hide(h); await h.goto("/"); await h.sleep(0.8); } },
    { caption: "5. Choose what you will use Vifug for.", say: "First, choose what you will use Vifug for: Church, Media and entertainment, or Presentations only. Church is everything.", minHold: 9,
      run: async (h) => {
        const d = h.page.locator("[role=dialog]");
        await h.glide(640, 440, 600); await h.glide(820, 440, 700); await h.glide(500, 440, 500);
        await h.click(d.getByRole("radio", { name: /^Church/ }));
        await h.sleep(0.8);
        await h.click(d.getByRole("button", { name: "Next", exact: true }));
      } },
    { caption: "6. Choose how many lines of a song show at once.", say: "Next, choose how many lines of a song to show at once. Three lines is a good middle for most rooms.", minHold: 7,
      run: async (h) => {
        const d = h.page.locator("[role=dialog]");
        await h.click(d.getByText("Balanced").first());
        await h.sleep(1.0);
        await h.click(d.getByRole("button", { name: "Next", exact: true }));
      } },
    { caption: "7. Church only: keep the included songs, or start empty.", say: "For Church, the last question is whether to keep the songs that come with the app. Keeping them gives you a working library from the first minute.", minHold: 8,
      run: async (h) => {
        const d = h.page.locator("[role=dialog]");
        await h.glide(640, 440, 500); await h.sleep(4.0);
        await h.click(d.getByText("Use the included songs").first());
      } },
    { caption: "8. You arrive at the library, with 325 songs ready.", say: "Then you arrive at the library, with three hundred and twenty five songs ready to use.", minHold: 5,
      run: async (h) => { await h.glide(140, 300, 700); await h.sleep(0.6); await h.glide(140, 660, 600); } },
    { caption: "You can change any answer later in Settings, then General.", say: "None of this is final. You can change any answer later, in Settings, then General.", minHold: 5,
      run: async (h) => {
        await h.click(h.page.getByRole("button", { name: "Settings" }).first());
        await h.click(h.page.getByText("General", { exact: true }).first());
        await h.sleep(0.8);
      } },
  ],
};
