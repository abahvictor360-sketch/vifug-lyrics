import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Picture-in-picture for the live output.
 *
 * Uses the Document Picture-in-Picture API (Chrome / Edge 116+), which gives a
 * small always-on-top window that can hold real DOM - so the floating picture
 * is the same LiveOutput the projector draws, not a video of it. The window
 * floats over other apps, which is the point: the operator can watch what is
 * on air while working in a slide deck, a browser tab or a Bible app.
 *
 * `supported` is false elsewhere (Firefox, Safari); the caller hides the
 * control rather than offering one that cannot work.
 */

type PipWindow = Window;
type DocumentPiP = {
  requestWindow: (opts?: { width?: number; height?: number; disallowReturnToOpener?: boolean }) => Promise<PipWindow>;
  window: PipWindow | null;
};

function api(): DocumentPiP | null {
  return (window as unknown as { documentPictureInPicture?: DocumentPiP }).documentPictureInPicture ?? null;
}

/** Copy the page's styles into the floating window, which starts empty. */
function copyStyles(target: Document) {
  const html = target.documentElement;
  html.className = document.documentElement.className;
  for (const attr of Array.from(document.documentElement.attributes)) {
    if (attr.name !== "class") html.setAttribute(attr.name, attr.value);
  }
  for (const node of Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))) {
    target.head.appendChild(node.cloneNode(true));
  }
}

export function usePictureInPicture() {
  const [pipWindow, setPipWindow] = useState<PipWindow | null>(null);
  const supported = typeof window !== "undefined" && !!api();
  const current = useRef<PipWindow | null>(null);

  const close = useCallback(() => {
    current.current?.close();
    current.current = null;
    setPipWindow(null);
  }, []);

  const open = useCallback(async () => {
    const pip = api();
    if (!pip) return;
    if (current.current) return;
    try {
      const win = await pip.requestWindow({ width: 480, height: 270 });
      copyStyles(win.document);
      win.document.body.style.margin = "0";
      win.document.body.style.background = "#000";
      win.document.body.style.overflow = "hidden";
      // The window can be closed from its own title bar, so follow it.
      win.addEventListener("pagehide", () => {
        if (current.current === win) {
          current.current = null;
          setPipWindow(null);
        }
      });
      current.current = win;
      setPipWindow(win);
    } catch {
      // Refused (no user gesture, or blocked by policy): nothing to show.
    }
  }, []);

  const toggle = useCallback(() => (current.current ? close() : open()), [open, close]);

  // The floating window belongs to this page; it must not outlive it.
  useEffect(() => () => current.current?.close(), []);

  return { supported, pipWindow, active: pipWindow !== null, open, close, toggle };
}
