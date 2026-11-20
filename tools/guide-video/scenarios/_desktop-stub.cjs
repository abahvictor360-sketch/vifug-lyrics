// Minimal window.electronAPI so the web build renders the panels that only exist when the desktop app is detected.
// It provides NO behaviour: no backup, restore, import or update function exists on it, only inert no-ops for the
// display/projector listeners the operator page registers at start-up, and the real app version.
exports.installDesktopStub = async (h, version) => {
  // The launch-time update check would ask GitHub; keep it silent and offline so nothing made-up or real-but-unrelated pops up.
  await h.page.route(/api\.github\.com/, (r) => r.abort());
  await h.page.addInitScript((version) => {
    const off = () => () => {};
    window.electronAPI = {
      platform: "linux",
      getAppVersion: () => Promise.resolve(version),
      listDisplays: () => Promise.resolve([]),
      onDisplaysChanged: off,
      projectorStatus: () => Promise.resolve({ open: false, screens: [] }),
      onProjectorState: off,
      onDeepLink: off,
      onMenuAction: off,
    };
  }, version);
};
