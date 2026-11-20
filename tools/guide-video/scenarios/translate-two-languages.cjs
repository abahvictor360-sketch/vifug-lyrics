const fs = require("fs");
const path = require("path");
const BIBLE = path.resolve(__dirname, "../../../packages/web/public/bible");
const verse = (v) => JSON.parse(fs.readFileSync(path.join(BIBLE, v, "JHN.json"), "utf8")).c["3"][15];
const KJV = verse("kjv");   // read from the app's own data at record time
const YOR = verse("yor");   // never typed from memory
const SONG = "John 3:16";
// Split the KJV text into lines at its own commas.
const PARTS = KJV.split(/(?<=,)\s+/);
module.exports = {
  name: "translate-two-languages",
  async setup(h) {
    await h.goto("/");
    await h.page.evaluate(async ([title, lyrics]) => {
      await fetch("/api/songs", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sections: [{ type: "verse", label: "Verse 1", number: 1, lyrics }] }) });
    }, [SONG, PARTS.join("\n")]);
    await h.goto("/");
  },
  steps: [
    { caption: "Show your songs and Scripture in two languages", say: "Show your songs and Scripture in two languages.",
      run: async (h) => { await h.glide(640, 300, 800); } },
    { caption: "1. Open a song from the library.", say: "Open a song from the library.",
      run: async (h) => { await h.type('input[placeholder^="Search library"]', "john 3"); await h.click(h.page.getByText(SONG).first()); } },
    { caption: "2. Press Translate to add a second-language line for each section.", say: "Press Translate to add a second language, one section at a time.",
      run: async (h) => { await h.click(h.page.getByRole("button", { name: /Translate/ })); await h.sleep(0.6); }, minHold: 4 },
    { caption: "3. Pick the language, then type the translation next to the original.", say: "Pick the language, then type the translation beside the original words. Here it is the Yoruba text of John three sixteen, taken from the app's own Yoruba Bible. It saves when you click away.",
      run: async (h) => {
        const sel = h.page.locator("#translations-title").locator("xpath=ancestor::div[contains(@class,'rounded-xl')]").locator("select"); await h.click(sel); await sel.selectOption("yo"); await h.sleep(0.4);
        const ta = h.page.locator("textarea").first();
        await h.click(ta);
        await h.page.keyboard.type(YOR, { delay: 20 });
        await h.sleep(0.4);
        await h.click(h.page.getByText("Translations", { exact: true }).first()); await h.sleep(0.8); }, minHold: 9 },
    { caption: "4. Click Done, then open Settings.", say: "Click Done, then open Settings.",
      run: async (h) => { await h.click(h.page.getByText("Done", { exact: true })); await h.click(h.page.getByRole("button", { name: /Settings/ }).first()); await h.sleep(0.4); } },
    { caption: "5. Turn on Dual language and pick the same language.", say: "Under Dual language, turn on the translation line, and choose the same language.",
      run: async (h) => {
        const g = h.page.getByText("Dual language", { exact: true }).first();
        await g.scrollIntoViewIfNeeded(); await h.sleep(0.4);
        await h.click(h.page.getByText("Show a translation line under the lyrics"), { fx: 0.9 });
        await h.sleep(0.4);
        await h.page.locator("label:has-text('Secondary language') select").selectOption("yo"); await h.sleep(0.8); }, minHold: 7 },
    { caption: "6. Select the section and Go Live. Both languages show at once.", say: "Now select the section and press Go Live. Both languages appear on the screen together.",
      run: async (h) => {
        await h.click(h.page.getByText("Done", { exact: true }));
        await h.click(h.page.getByText(PARTS[0]).first());
        await h.sleep(0.5); await h.click(h.page.getByRole("button", { name: /GO LIVE/i })); await h.sleep(1); }, minHold: 7 },
    { caption: "7. Scripture has languages too. Open the Bible tab.", say: "Scripture works the same way. Open the Bible tab.",
      run: async (h) => { await h.click(h.page.getByRole("button", { name: /^Bible/ }).first()); await h.sleep(0.6); } },
    { caption: "8. Pick a version in another language from the version list.", say: "The English versions are always there. Yoruba, Hausa and Igbo can be switched on in Settings, then Bible, and then they appear in the version list.",
      run: async (h) => { await h.click(h.page.locator("select").first()); await h.page.locator("select").first().selectOption("yor"); await h.sleep(0.8); }, minHold: 8 },
    { caption: "9. Type a reference, press Enter to preview, and again to go live.", say: "Type a reference, such as John three sixteen. Enter previews it, and Enter again sends it live.",
      run: async (h) => { await h.type('input[placeholder^="Reference"]', "john 3 16"); await h.press("Enter", 1.2); await h.press("Enter", 1.2); }, minHold: 7 },
    { caption: "Songs and Scripture, in the languages your people speak.", say: "Songs and Scripture, in the languages your people speak.",
      run: async (h) => { await h.sleep(0.4); } },
  ],
};
