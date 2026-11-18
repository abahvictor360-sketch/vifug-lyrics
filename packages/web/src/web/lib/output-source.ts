import type { ElectronAPI } from "./desktop";

type Surface = { title: string; temporary: boolean };
type Source = { id: string; name: string; kind: string };

/**
 * Find the window to record or stream and return its capture source.
 *
 * The output is captured by finding its window in the operating system's
 * window list. That list is the one place this can go wrong - a fullscreen
 * window on another monitor, a title the system words slightly differently -
 * so when the projector cannot be found the picture is not given up on:
 * the main process makes a surface of its own showing the same live output
 * (what already happens when no projector is open) and that is captured
 * instead. Returns null only if even that cannot be found.
 */
export async function findOutputSource(
  desktop: ElectronAPI,
  surface: Surface,
  size?: { width?: number; height?: number },
): Promise<{ source: Source; surface: Surface } | null> {
  const lookup = async (s: Surface) => {
    const sources = (await desktop.listCaptureSources?.()) ?? [];
    const windows = sources.filter((x) => x.kind === "window");
    return (
      windows.find((x) => x.name === s.title) ??
      // Some systems add or trim text around a window's title.
      windows.find((x) => x.name.startsWith(s.title) || x.name.includes(s.title)) ??
      null
    );
  };
  const first = await lookup(surface);
  if (first) return { source: first, surface };
  if (surface.temporary || !desktop.recorderSurface) return null;
  const own = await desktop.recorderSurface(size, true);
  const second = await lookup(own);
  if (second) return { source: second, surface: own };
  // Nothing to capture after all: do not leave the surface just made open.
  await desktop.recorderRelease?.();
  return null;
}
