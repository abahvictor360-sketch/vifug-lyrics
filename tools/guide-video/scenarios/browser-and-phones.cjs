const card = require("./_cards-install-browser.cjs");
module.exports = {
  name: "browser-and-phones",
  async setup(h) { await h.goto("/"); },
  steps: [
    { caption: "Vifug in a browser, and connecting phones", say: "Vifug in a browser, and how phones and tablets connect.",
      run: async (h) => { await h.glide(640, 300, 500); } },
    { caption: "1. Vifug also runs as a web app. There is nothing to install.", say: "Vifug also runs as a web app. This is the browser version, so there is nothing to install.", minHold: 5,
      run: async (h) => { await h.glide(800, 24, 800); await h.sleep(0.6); await h.glide(890, 24, 400); } },
    { caption: "2. The projector, stage display, remote and OBS source are pages at the app's own address.", say: "The projector, stage display, phone remote and OBS source are each a page at the app's own address. Settings, then Streaming and output, lists them.", minHold: 8,
      run: async (h) => {
        await h.click(h.page.getByRole("button", { name: "Settings" }).first());
        await h.click(h.page.getByText("Streaming & output", { exact: true }).first());
        await h.page.getByText("Outputs & companion screens").first().scrollIntoViewIfNeeded();
        await h.page.mouse.move(700, 400); await h.page.mouse.wheel(0, 450); await h.sleep(0.8);
        await h.glide(1100, 478, 600); await h.glide(1100, 504, 500); await h.glide(1100, 530, 500);
      } },
    { caption: "3. Browser version: no same Wi-Fi rule and no firewall step.", say: "On the hosted app, the devices reach each other through the server. A phone on mobile data works, and there is no firewall step.", minHold: 8,
      run: async (h) => { await h.sleep(1.0); } },
    { caption: "4. The Remote PIN is the only thing between a stranger and your live screen.", say: "Because anyone with the link could open the remote, the PIN matters. It is shown here, under Remote PIN.", minHold: 7,
      run: async (h) => {
        await h.click(h.page.getByRole("button", { name: "Show", exact: true }).first());
        await h.sleep(1.5);
      } },
    { caption: "5. On the phone, open the remote page and enter the PIN.", say: "On the phone, open the remote page and type in the PIN. Each phone is asked once.", minHold: 8,
      run: async (h) => {
        const pin = await h.page.evaluate(async () => (await (await fetch("/api/settings")).json()).config.remote.pin);
        await h.goto("/#/remote", "text=Vifug Remote"); await h.sleep(1.0);
        await h.type("input", pin, 120);
        await h.click(h.page.getByRole("button", { name: "Unlock" }));
        await h.sleep(1.5);
      } },
    { caption: "6. What only the desktop app does", say: "Some things need the desktop app: native NDI output, streaming to platforms straight from Vifug, and working with no internet at all.", minHold: 9,
      run: async (h) => card.show(h, "What only the desktop app does", [
        ["Native NDI output", "Direct NDI from Vifug is desktop-only. In a browser, use the OBS bridge."],
        ["Streaming to platforms", "Going live to YouTube, Facebook and more from Vifug needs the desktop app."],
        ["No internet needed", "The desktop app works fully offline. A hosted app needs a connection."],
        ["Your media files", "Media added in a browser stays in that browser. Other devices cannot see it."],
      ]) },
    { caption: "7. Desktop app: Windows may block phones until you allow Vifug.", say: "On the desktop app for Windows, the firewall blocks other devices until you allow Vifug. In Settings, Streaming and output, press Allow through the firewall, and approve the administrator prompt.", minHold: 11,
      run: async (h) => card.show(h, "Phones cannot load the page on Windows", [
        ["1. Open", "Settings, then Streaming & output, then On another device (same Wi-Fi)."],
        ["2. Look", "An amber notice says Windows Firewall has no rule for Vifug."],
        ["3. Press", "Allow through the firewall, and accept the administrator prompt."],
        ["4. Try again", "Type one of the listed addresses into the phone's browser, port included."],
      ], "Only on the same network as the computer, not a guest Wi-Fi. Not needed in the browser version.") },
    { caption: "Browser version: open the page and enter the PIN. Desktop app: allow the firewall once.", say: "In short: in a browser, open the page and enter the PIN. On the desktop app, allow the firewall once.", minHold: 6,
      run: async (h) => { await card.hide(h); } },
  ],
};
