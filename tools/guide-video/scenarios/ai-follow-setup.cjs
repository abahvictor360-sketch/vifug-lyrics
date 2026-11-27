const C = require("./_cards.cjs");
const dialog = (h) => h.page.locator('[role="dialog"]');
const openAi = async (h) => {
  await h.click(h.page.getByText("Settings", { exact: true }).first());
  await h.click(h.page.getByRole("button", { name: /AI auto-follow/ }).first());
  await h.sleep(0.5);
};
module.exports = {
  name: "ai-follow-setup",
  async setup(h) { await h.goto("/"); },
  steps: [
    { caption: "How to set up AI auto-follow",
      say: "This video shows how to set up AI auto-follow, step by step. It takes about three minutes.",
      run: async (h) => { await h.sleep(1); } },

    { caption: "1. Decide how it will listen.",
      say: "One. Decide how Vifug will listen. Deepgram is online, needs a free key, and needs the internet during the service. On this machine runs on your own computer, needs no key, and works offline once its model is downloaded. Either way, you need a microphone that hears the room.",
      run: async (h) => {
        await C.showCard(h, { kicker: "Before you start", title: "Two ways to listen", items: [
          "<b>Deepgram (online)</b>: the better of the two. Needs a free key and the internet throughout the service",
          "<b>On this machine</b>: Whisper on your own computer. No key, no account, and offline once the model is downloaded. Slower and rougher",
          "Either way: a microphone that hears the room",
        ] });
      }, minHold: 6 },

    { caption: "2. Get a free Deepgram key.",
      say: "Two. For Deepgram, make a free account at console dot deepgram dot com. New accounts include free credit, and no card is needed. Verify your email, open the Console, then go to API Keys, and Create a Key. Give it a name you will recognise, and leave the default permissions. Copy the key straight away, because Deepgram shows it only once.",
      run: async (h) => {
        await C.showCard(h, { kicker: "On deepgram.com", title: "Create your key", items: [
          "Sign up at <b>console.deepgram.com/signup</b>. New accounts include free credit, and no card is needed",
          "Verify your email and open the <b>Console</b>",
          "Open <b>API Keys</b>, then <b>Create a Key</b>. Name it, for example <b>Vifug auto-follow</b>, and leave the default Member permissions",
          "<b>Copy the key straight away</b>. Deepgram shows it only once",
        ] });
      }, minHold: 10 },

    { caption: "3. Settings, then AI auto-follow.",
      say: "Three. In Vifug, open Settings, then AI auto-follow.",
      run: async (h) => { await C.hideCard(h); await openAi(h); await h.sleep(1); } },

    { caption: "4. Paste the key into Deepgram API key.",
      say: "Four. Make sure Deepgram is chosen as the engine, and paste your key into the Deepgram API key box. It is kept only on your own computer. Then set the spoken language to the one your congregation sings in, or choose Multi, to follow a mix of languages.",
      run: async (h) => {
        await h.click(dialog(h).getByRole("button", { name: "Deepgram (online)" }));
        const key = dialog(h).getByPlaceholder("dg_...");
        await key.scrollIntoViewIfNeeded(); await h.sleep(0.6);
        await h.click(key); await h.sleep(3);
        const lang = dialog(h).locator("select").filter({ hasText: "Multi (auto-detect)" }).first();
        await lang.scrollIntoViewIfNeeded(); await h.sleep(1);
        await lang.selectOption({ label: "English" });
        await h.sleep(3);
      } },

    { caption: "5. Choose the microphone and press Test.",
      say: "Five. Choose the microphone that hears the room, and press Test before the service. Auto-follow cannot advance on a microphone that is not picking anything up.",
      run: async (h) => {
        const mic = dialog(h).locator("select").filter({ hasText: "System default microphone" }).first();
        await mic.scrollIntoViewIfNeeded(); await h.sleep(1);
        await h.glide(700, 330); await h.sleep(5);
      } },

    { caption: "6. Choose what it follows.",
      say: "Six. Choose what it follows. Advance slides automatically moves song slides as they are sung. Follow spoken scripture references puts up a verse when the preacher reads it out. Turn on Follow quoted scripture too, if you want a verse that is quoted without being named.",
      run: async (h) => {
        const songs = dialog(h).getByText("Advance slides automatically by listening to the room").first();
        await songs.scrollIntoViewIfNeeded(); await h.sleep(3);
        const scr = dialog(h).getByText("Follow spoken scripture references").first();
        await scr.scrollIntoViewIfNeeded(); await h.sleep(0.8);
        await h.click(scr); await h.sleep(2);
        const q = dialog(h).getByText("Follow quoted scripture").first();
        await q.scrollIntoViewIfNeeded(); await h.sleep(0.8);
        await h.click(q); await h.sleep(3);
      } },

    { caption: "7. Choose Preview or Live.",
      say: "Seven. Choose where a heard verse goes. Preview is the default: the verse waits for you to press Go Live, so a mistake costs a glance, not the congregation's attention. Live sends it straight to the screen.",
      run: async (h) => {
        const prev = dialog(h).getByRole("button", { name: /^Preview/ }).first();
        await prev.scrollIntoViewIfNeeded(); await h.sleep(1);
        await h.click(prev); await h.sleep(5);
      } },

    { caption: "8. Turn it on in the AI Auto-Follow panel.",
      say: "Eight. Close Settings. Turn on the AI Auto-Follow switch in the panel on the main screen, and Vifug starts listening. Do it before the service, not in the middle of the sermon. Your own next and previous keys always override it.",
      run: async (h) => {
        await h.click(dialog(h).getByRole("button", { name: "Done", exact: true }));
        const label = h.page.getByText("AI Auto-Follow", { exact: true }).first();
        await label.scrollIntoViewIfNeeded(); await h.sleep(1);
        await h.glide(1235, 623); await h.sleep(5);
      } },

    { caption: "No internet? Choose On this machine instead.",
      say: "No internet at church? Choose On this machine, instead. Pick a model, and Base is a good place to start. It downloads once, and after that no internet is needed.",
      run: async (h) => {
        await openAi(h);
        await h.click(dialog(h).getByRole("button", { name: "On this machine" }));
        const sel = dialog(h).locator("select").filter({ hasText: "Tiny (English)" }).first();
        await sel.scrollIntoViewIfNeeded(); await h.sleep(1);
        await sel.selectOption({ label: "Base (English) - ~80 MB" });
        await h.sleep(5);
        await h.click(dialog(h).getByRole("button", { name: "Done", exact: true }));
      } },

    { caption: "That is the set-up.",
      say: "That is the set-up. Test the microphone before the service, and your next and previous keys always win.",
      run: async (h) => { await h.sleep(1); }, minHold: 4 },
  ],
};
