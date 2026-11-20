module.exports = {
  name: "smoke",
  async setup(h) { await h.goto("/"); },
  steps: [
    { caption: "Search for a song in the library on the left.", say: "Search for a song in the library, on the left.",
      run: async (h) => { await h.type('input[placeholder^="Search library"]', "amazing"); } },
    { caption: "Click the song to open it.", say: "Click the song to open it.",
      run: async (h) => { await h.click(h.page.getByText("Amazing Grace!").first()); } },
    { caption: "Press Go Live to send it to the screen.", say: "Press Go Live to send it to the screen.",
      run: async (h) => { await h.click(h.page.locator("text=Amazing grace! how sweet the sound!").first()); await h.click(h.page.getByRole("button", { name: /GO LIVE/i })); } },
  ],
};
