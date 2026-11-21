/**
 * Copying styled text inside Vifug and pasting it back with its style.
 *
 * The text boxes here keep their words in a plain string and their styling in
 * character ranges beside it (see rich-text.ts). A normal copy only carries the
 * string, so pasting bold, underlined or highlighted words into another slide
 * gave plain words. This puts the ranges on the clipboard too, under a type of
 * our own, and reads them back on paste.
 *
 * Three things go out on every copy:
 *   - text/plain  - what every other app, and every plain input here, expects;
 *   - text/html   - so the style survives a paste into Word or Docs as well;
 *   - our own type with the exact ranges, which is what Vifug itself reads.
 *
 * Some browsers drop custom clipboard types, so the last copy is also kept in
 * memory. A paste uses it only when the clipboard's plain text is exactly the
 * text that was copied - copy something else in between, anywhere, and the
 * plain text no longer matches, so stale style can never be applied to it.
 */
import { clearMarks, normalize, shiftFormats, type TextFormat } from "./rich-text";

export const RICH_MIME = "application/x-vifug-rich";

export type RichPayload = { text: string; formats: TextFormat[] };

type ClipEvent = { clipboardData: DataTransfer | null; preventDefault: () => void };

const eol = (s: string) => s.replace(/\r\n?/g, "\n");

/** The ranges that fall inside start..end, moved so 0 is the start of the copied text. */
export function sliceFormats(formats: TextFormat[], start: number, end: number): TextFormat[] {
  const out: TextFormat[] = [];
  for (const f of formats) {
    const s = Math.max(f.start, start);
    const e = Math.min(f.end, end);
    if (e > s) out.push({ ...f, start: s - start, end: e - start });
  }
  return normalize(out);
}

export function richPayload(text: string, formats: TextFormat[], start: number, end: number): RichPayload {
  return { text: text.slice(start, end), formats: sliceFormats(formats, start, end) };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The same text as HTML spans, for pasting into other programs. */
export function richToHtml(p: RichPayload): string {
  const norm = normalize(p.formats);
  let out = "";
  let cursor = 0;
  const span = (text: string, f?: TextFormat) => {
    if (!text) return;
    const css: string[] = [];
    if (f?.bold) css.push("font-weight:bold");
    if (f?.italic) css.push("font-style:italic");
    if (f?.underline) css.push("text-decoration:underline");
    if (f?.color) css.push(`color:${f.color}`);
    if (f?.highlight) css.push(`background-color:${f.highlight}`);
    const body = esc(text).replace(/\n/g, "<br>");
    out += css.length ? `<span style="${css.join(";")}">${body}</span>` : body;
  };
  for (const f of norm) {
    span(p.text.slice(cursor, f.start));
    span(p.text.slice(f.start, f.end), f);
    cursor = f.end;
  }
  span(p.text.slice(cursor));
  return `<meta charset="utf-8">${out}`;
}

let lastCopy: RichPayload | null = null;

/**
 * Put a selection on the clipboard with its style. Returns false (and leaves
 * the browser's own copy alone) when the selection carries no style at all.
 */
export function copyRich(e: ClipEvent, payload: RichPayload): boolean {
  if (!e.clipboardData || !payload.text) return false;
  if (!payload.formats.length) {
    lastCopy = null;
    return false;
  }
  e.clipboardData.setData("text/plain", payload.text);
  e.clipboardData.setData("text/html", richToHtml(payload));
  try {
    e.clipboardData.setData(RICH_MIME, JSON.stringify(payload));
  } catch {
    /* a browser that refuses custom types still gets the in-memory copy below */
  }
  lastCopy = payload;
  e.preventDefault();
  return true;
}

/** The styled text this paste is carrying, if it is the styled text we copied. */
export function readRich(e: { clipboardData: DataTransfer | null }): RichPayload | null {
  const cd = e.clipboardData;
  if (!cd) return null;
  const plain = eol(cd.getData("text/plain"));
  let payload: RichPayload | null = null;
  try {
    const raw = cd.getData(RICH_MIME);
    if (raw) {
      const parsed = JSON.parse(raw) as RichPayload;
      if (parsed && typeof parsed.text === "string" && Array.isArray(parsed.formats)) payload = parsed;
    }
  } catch {
    payload = null;
  }
  payload ??= lastCopy;
  if (!payload || !payload.formats.length) return null;
  // The guard: only when what is being pasted is exactly what was copied.
  return eol(payload.text) === plain ? payload : null;
}

/**
 * Insert styled text over a selection. The pasted words carry their own style
 * and nothing from the words around them: pasting into the middle of a bold
 * phrase must not make the pasted words bold unless they were.
 */
export function insertRich(
  value: string,
  formats: TextFormat[],
  selStart: number,
  selEnd: number,
  payload: RichPayload,
): { value: string; formats: TextFormat[]; caret: number } {
  const text = eol(payload.text);
  const next = value.slice(0, selStart) + text + value.slice(selEnd);
  const end = selStart + text.length;
  let f = shiftFormats(formats, selStart, selEnd, text.length);
  f = clearMarks(f, selStart, end);
  f = normalize([
    ...f,
    ...payload.formats.map((x) => ({ ...x, start: x.start + selStart, end: x.end + selStart })),
  ]);
  return { value: next, formats: f, caret: end };
}

/** Split a styled paste at paragraph breaks, keeping each paragraph's own style. */
export function splitRichParagraphs(payload: RichPayload): RichPayload[] {
  const text = eol(payload.text);
  const out: RichPayload[] = [];
  const re = /\n[ \t]*\n+/g;
  let from = 0;
  const cut = (s: number, e: number) => {
    const raw = text.slice(s, e);
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (!body) return;
    const start = s + lead;
    out.push({ text: body, formats: sliceFormats(payload.formats, start, start + body.length) });
  };
  for (let m = re.exec(text); m; m = re.exec(text)) {
    cut(from, m.index);
    from = m.index + m[0].length;
  }
  cut(from, text.length);
  return out;
}
