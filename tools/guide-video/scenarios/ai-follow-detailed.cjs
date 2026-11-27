const C = require("./_cards.cjs");
const dialog = (h) => h.page.locator('[role="dialog"]');
const openAi = async (h) => {
  await h.click(h.page.getByText("Settings", { exact: true }).first());
  await h.click(h.page.getByRole("button", { name: /AI auto-follow/ }).first());
  await h.sleep(0.5);
};
module.exports = {
  name: "ai-follow-detailed",
  async setup(h) { await h.goto("/"); },
  steps: [
    { caption: "How AI auto-follow works",
      say: "Vifug can listen to the room and keep the screen with the service. This video shows how it works, and how to set it up.",
      run: async (h) => { await h.sleep(1); } },

    { caption: "1. Settings, then AI auto-follow. Your own keys always win.",
      say: "One. Everything lives in Settings, then AI auto-follow. And your own next and previous keys always win. The moment you touch a control, auto-follow carries on from wherever you left it.",
      run: async (h) => { await openAi(h); await h.sleep(1.5); } },

    { caption: "2. Choose an engine: Deepgram, or On this machine.",
      say: "Two. Choose how Vifug listens. Deepgram is the default, and the better of the two. It needs a free key and a working internet connection. On this machine runs Whisper on your own computer. No key, no account, and once the model is downloaded, no internet. It is slower and rougher, but it keeps working when the hall Wi-Fi does not.",
      run: async (h) => {
        await h.click(h.page.getByRole("button", { name: "On this machine" }));
        await h.sleep(3);
        await h.click(h.page.getByRole("button", { name: "Deepgram (online)" }));
        await h.sleep(2);
        await h.click(h.page.getByRole("button", { name: "On this machine" }));
      } },

    { caption: "3. On this machine: pick a model. Base is a good start.",
      say: "Three. For the on-device engine, pick a model. Tiny is the fastest and will mis-hear names. Base is a clear step up, and a good place to start. Small is better with names and numbers. Large v3 Turbo is the most accurate, but it needs a graphics card, or it falls behind the preacher. The model downloads once, with a progress bar, and after that no internet is needed.",
      run: async (h) => {
        const sel = dialog(h).locator("select").filter({ hasText: "Tiny (English)" }).first();
        await sel.scrollIntoViewIfNeeded(); await h.sleep(1);
        await h.glide(560, 300);
        await sel.selectOption({ label: "Base (English) - ~80 MB" });
        await h.sleep(6);
      } },

    { caption: "4. Accented English and your language.",
      say: "Four. If your congregation speaks English with a Nigerian, Ghanaian, Kenyan, Caribbean or Indian accent, turn on, The English here is accented. You can also choose a spoken language, including Yoruba, Hausa and Swahili. Whisper cannot hear Igbo, Pidgin or Twi, so for those you put the passage up by hand.",
      run: async (h) => {
        await h.click(dialog(h).getByText("The English here is accented").first());
        await h.sleep(3);
        const lang = dialog(h).locator("select").filter({ hasText: "Yoruba" }).first();
        await lang.scrollIntoViewIfNeeded(); await h.sleep(1);
        await lang.selectOption({ label: "Yoruba" });
        await h.sleep(5);
      } },

    { caption: "5. Songs: advance slides by listening to the room.",
      say: "Five. For songs, turn on Advance slides automatically. Vifug matches what it hears against the next few slides, and jumps to the furthest confident match. Two dials let you choose how many words of a slide must be heard, and how far ahead it looks.",
      run: async (h) => {
        const top = dialog(h).getByText("Advance slides automatically by listening to the room").first();
        await top.scrollIntoViewIfNeeded(); await h.glide(840, 200); await h.sleep(5);
        const sens = dialog(h).getByText("SENSITIVITY", { exact: false }).first();
        await sens.scrollIntoViewIfNeeded(); await h.sleep(5);
      } },

    { caption: "6. Scripture: Follow spoken scripture references.",
      say: "Six. For scripture, turn on Follow spoken scripture references. When the preacher says, turn with me to John chapter three verse sixteen, Vifug cues John three sixteen, while the sentence is still being spoken. The rest of the reading follows without the book being named again. Verse nine, or verses ten to twelve, carry on from the passage already up.",
      run: async (h) => {
        const sw = dialog(h).getByText("Follow spoken scripture references").first();
        await sw.scrollIntoViewIfNeeded(); await h.sleep(1);
        await h.click(sw);
        await h.sleep(5);
        await h.click(dialog(h).getByRole("button", { name: "Done", exact: true }));
        await C.showCard(h, { kicker: "What it hears", title: "A reference read out", items: [
          "&ldquo;Turn with me to John chapter three verse sixteen&rdquo; cues <b>John 3:16</b>",
          "It acts while the sentence is still being spoken, not after a pause",
          "&ldquo;Verse nine&rdquo;, &ldquo;verses ten to twelve&rdquo; and &ldquo;look over at chapter four&rdquo; carry on from the passage already up",
        ] });
        await h.sleep(6);
      }, minHold: 6 },

    { caption: "7. Follow quoted scripture: a verse said word for word.",
      say: "Seven. Turn on Follow quoted scripture, and Vifug will also find a verse that is said without being cited. It only answers on a long, near exact run of words that lands on exactly one verse. So a common phrase settles nothing.",
      run: async (h) => {
        await C.hideCard(h);
        await openAi(h);
        const q = dialog(h).getByText("Follow quoted scripture").first();
        await q.scrollIntoViewIfNeeded(); await h.sleep(0.8);
        await h.click(q); await h.sleep(3);
        await h.click(dialog(h).getByRole("button", { name: "Done", exact: true }));
        await C.showCard(h, { kicker: "What it hears", title: "A verse quoted, not cited", items: [
          "Say the words of a verse, such as &ldquo;for God so loved the world&hellip;&rdquo;, and Vifug finds it",
          "It only answers on a long, near exact run of words that lands on <b>exactly one verse</b>",
          "A common phrase such as &ldquo;and the Lord spake unto Moses&rdquo; settles nothing",
        ] });
        await h.sleep(6);
      }, minHold: 5 },

    { caption: "8. A verse in the preacher's own words.",
      say: "Eight. It can even find a paraphrase. Vifug ranks the verses that share the key words, and offers the best one with a confidence figure. It only speaks up at seventy five percent or more. For matching by meaning, there is an optional small model, about twenty three megabytes, that runs on your computer and works offline.",
      run: async (h) => {
        await C.showCard(h, { kicker: "What it hears", title: "A paraphrase", items: [
          "Say what a verse says in your own words and Vifug ranks the verses that share your key words",
          "It offers the best one with a <b>confidence figure</b>, and only speaks up at 75% or more",
          "By default it matches words, not meaning. <b>Understand paraphrases by meaning</b> adds a small model (about 23 MB, downloaded once) that works offline",
        ] });
      }, minHold: 7 },

    { caption: "9. A translation named out loud.",
      say: "Nine. If the preacher names a translation, as in, John three sixteen in the Message, Vifug switches the version as well as the passage. Only the versions you have switched on count.",
      run: async (h) => {
        await C.hideCard(h);
        await openAi(h);
        const t = dialog(h).getByText("Switch translation when it is named").first();
        await t.scrollIntoViewIfNeeded(); await h.sleep(0.8);
        await h.click(t); await h.sleep(3);
        await h.click(dialog(h).getByRole("button", { name: "Done", exact: true }));
        await C.showCard(h, { kicker: "What it hears", title: "A translation named aloud", items: [
          "&ldquo;John three sixteen in the Message&rdquo; changes the version as well as the passage",
          "&ldquo;Read that again in the Amplified&rdquo; re-reads what is already up",
          "Only versions you have switched on in Settings, then Bible, count",
        ] });
        await h.sleep(6);
      }, minHold: 5 },

    { caption: "10. Preview or Live, chosen for each kind of match.",
      say: "Ten. You choose where each kind of detection goes, in the AI Auto-Follow panel on the main screen. Preview means the verse waits for you to press Go Live. Live means straight to the congregation. A sensible mix is a cited reference going Live, while a quotation or a paraphrase waits in Preview.",
      run: async (h) => {
        await C.showCard(h, { kicker: "Where a match goes", title: "Chosen separately for each kind", items: [
          "<b>Reference read out</b>: Preview or Live. A cited reference is unmistakable, so it is the safe one to send straight out",
          "<b>Verse quoted</b>: Preview or Live. A quotation is a judgement, so it starts on Preview",
          "<b>Verse paraphrased</b>: Preview or Live. A ranked guess, so it also starts on Preview",
          "<b>Preview</b> waits for you to press GO LIVE. <b>Live</b> goes straight to the congregation",
        ] });
      }, minHold: 8 },

    { caption: "11. Every match shows a confidence figure.",
      say: "Eleven. Each detection is listed with a confidence figure. A cited reference is one hundred percent. A quotation and a paraphrase are as sure as their match. Anything waiting in Preview has a Present button, which puts it on the live screen in one press.",
      run: async (h) => {
        await C.showCard(h, { kicker: "Reading the list", title: "Confidence, and the Present button", items: [
          "A cited reference is <b>100%</b>",
          "A quotation is as sure as its match, between about <b>70% and 98%</b>",
          "A paraphrase is as sure as the share of rare words found, from <b>75%</b> and never above 97%",
          "Anything in Preview has a <b>Present</b> button: one press puts it on the live screen. Anything that went out says <b>Live</b>",
        ] });
      }, minHold: 7 },

    { caption: "12. Turn it on before the service.",
      say: "Twelve. Turn it on before the service, not in the middle of the sermon, because it prepares the Bible the first time. Most of the delay is the speech recognition. Deepgram hears words as they are spoken, and the on-device engine hears a phrase at a time.",
      run: async (h) => {
        await C.showCard(h, { kicker: "Before Sunday", title: "A few habits that help", items: [
          "Switch it on before the service: quoted-scripture following prepares the whole Bible version the first time",
          "Pick the microphone that hears the room, and press <b>Test</b>",
          "<b>Deepgram</b> hears words as they are spoken; the <b>on-device engine</b> hears a phrase at a time, so it is slower",
        ] });
      }, minHold: 7 },

    { caption: "You stay in charge.",
      say: "That is auto-follow. It listens, it suggests, and you decide what the room sees.",
      run: async (h) => { await C.hideCard(h); await h.sleep(1); }, minHold: 4 },
  ],
};
