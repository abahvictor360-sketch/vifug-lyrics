/**
 * Double-clicking should do what Vifug says it does, not also highlight a word.
 *
 * Double-click is an action here: on a slide it sends it live, on a verse or a
 * song it does the same. The browser, meanwhile, treats a double-click on any
 * text as "select this word" (and a triple-click as "select this paragraph"),
 * so every double-click left a block of highlighted text behind - and on a Bible
 * verse the selection also raised the formatting toolbar.
 *
 * The selection is started by the second mousedown, so that is where it is
 * stopped. A single press-and-drag still selects text, which marking up a verse
 * relies on, and text fields keep the ordinary double-click-to-select-a-word
 * that people expect when editing. An element can opt back in with
 * data-allow-select.
 */
const EDITABLE =
  "input, textarea, select, [contenteditable]:not([contenteditable='false']), [data-allow-select]";

type MaybeElement = { closest?: (selector: string) => unknown; parentElement?: MaybeElement | null };

/** Should this press be stopped from selecting text? */
export function blocksMultiClickSelect(target: unknown, detail: number): boolean {
  if (detail < 2) return false;
  // A text node is clicked as its parent element.
  let el = target as MaybeElement | null;
  if (el && typeof el.closest !== "function") el = el.parentElement ?? null;
  if (!el || typeof el.closest !== "function") return false;
  return !el.closest(EDITABLE);
}

/** Start stopping double and triple click selection on a page. Returns the way to stop. */
export function installNoMultiClickSelect(doc: Document = document): () => void {
  const onDown = (e: MouseEvent) => {
    if (e.button === 0 && blocksMultiClickSelect(e.target, e.detail)) e.preventDefault();
  };
  // Capture phase, so it runs before anything on the page can start a selection.
  doc.addEventListener("mousedown", onDown, true);
  return () => doc.removeEventListener("mousedown", onDown, true);
}
