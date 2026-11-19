module.exports = {
  name: "keyboard-shortcuts",
  async setup(h) { await h.goto("/"); },
  steps: [
    { caption: "Keyboard shortcuts", say: "Running the live controls from the keyboard.",
      run: async (h) => { await h.glide(640, 300, 500); } },
    { caption: "1. Open a song, then click a slide.", say: "Open a song, and click one of its slides.",
      run: async (h) => {
        await h.type('input[placeholder^="Search library"]', "amazing", 70);
        await h.click(h.page.getByText("Amazing Grace!").first());
        await h.sleep(0.6);
        await h.click(h.page.locator("text=Amazing grace! how sweet the sound!").first());
      } },
    { caption: "2. In Settings, General, turn off \"Next / Prev sends the slide live immediately\" to cue first.", say: "By default the arrow keys send a slide straight to the live screen. If you want them to only cue the preview, turn off Next and Prev sends the slide live immediately, in Settings, then General. We will do that here.", minHold: 12,
      run: async (h) => {
        await h.click(h.page.getByRole("button", { name: "Settings" }).first());
        await h.click(h.page.getByText("General", { exact: true }).first());
        const row = h.page.locator("label", { hasText: "Next / Prev sends the slide live immediately" });
        await row.scrollIntoViewIfNeeded(); await h.page.mouse.move(700, 300); await h.page.mouse.wheel(0, 200); await h.sleep(0.8);
        await h.click(row.locator("button, input, [role=switch]").first());
        await h.sleep(1.2);
        await h.click(h.page.getByRole("button", { name: "Done" }).first());
      } },
    { caption: "3. Right or Down arrow previews the next slide.", say: "The right arrow, the down arrow, or Page Down, previews the next slide.",
      run: async (h) => { await h.press("ArrowRight", 1.6); await h.press("ArrowDown", 1.6); } },
    { caption: "4. Left or Up arrow goes back one slide.", say: "The left arrow, the up arrow, or Page Up, goes back one.",
      run: async (h) => { await h.press("ArrowLeft", 1.4); } },
    { caption: "5. Enter sends the previewed slide live.", say: "Enter sends the previewed slide live.",
      run: async (h) => { await h.press("Enter", 1.5); } },
    { caption: "6. Space blanks the live output to black.", say: "Space blanks the live output to black.",
      run: async (h) => { await h.press("Space", 2.0); } },
    { caption: "7. Escape clears the live slide.", say: "Escape clears the live slide.",
      run: async (h) => { await h.press("Escape", 2.0); } },
    { caption: "Shortcuts pause while you type in a box, so song titles are safe to type.", say: "Shortcuts pause automatically while a text box is focused, so typing a song title never blanks the screen.", minHold: 6,
      run: async (h) => { await h.type('input[placeholder^="Search library"]', " ", 80); await h.page.keyboard.type("grace", { delay: 80 }); } },
    { caption: "8. To see or change the keys, open Settings, then Shortcuts.", say: "To see or change the keys, open Settings, then Shortcuts.", minHold: 5,
      run: async (h) => {
        await h.click(h.page.getByRole("button", { name: "Settings" }).first());
        await h.click(h.page.getByText("Shortcuts", { exact: true }).first());
        await h.sleep(0.8);
      } },
    { caption: "9. Change replaces a key. Add gives an action a second key.", say: "Change replaces an action's keys. Add gives it another key, which suits a presenter clicker.", minHold: 7,
      run: async (h) => {
        await h.glide(1145, 190, 700); await h.sleep(1.0); await h.glide(1083, 190, 500); await h.sleep(0.8);
        await h.glide(370, 497, 700);
      } },
    { caption: "Reset to defaults puts every key back.", say: "And Reset to defaults puts every key back.", minHold: 4,
      run: async (h) => { await h.click(h.page.getByRole("button", { name: "Reset to defaults" })); } },
  ],
};
