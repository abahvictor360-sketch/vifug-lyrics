/**
 * PPTX import (best-effort, offline, no native deps — same philosophy as the
 * ProPresenter/.docx importers in this folder).
 *
 * A .pptx is a zip of OOXML parts. We don't attempt a pixel-exact render of
 * shapes/positions/SmartArt — that would need a full layout engine. Instead,
 * per slide, we pull:
 *   - every text run (<a:t>) grouped by paragraph (<a:p>) → lines of text,
 *     with the first non-empty line treated as the heading and the rest as
 *     body — matching how this app already shows text over a background.
 *   - the first embedded image referenced by the slide (its relationships
 *     file), used as the slide's background.
 * Good enough to get a real deck's words and pictures on screen fast; not a
 * substitute for PowerPoint if a deck relies on precise layout.
 */
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";

export type ParsedPptxSlide = {
  heading: string;
  body: string; // newline-separated, may be empty
  image: { data: Uint8Array; ext: string } | null;
};

export type ParsedPptx = {
  title: string;
  slides: ParsedPptxSlide[];
};

const IMAGE_EXT_BY_CONTENT: Record<string, string> = {
  png: "png", jpg: "jpg", jpeg: "jpg", gif: "gif", bmp: "bmp", tiff: "tiff", emf: "emf", wmf: "wmf",
};

function textOf(el: Element): string {
  return el.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

/** All text runs in a slide, grouped into paragraph lines (non-empty only). */
function extractLines(slideXml: string): string[] {
  const doc = new DOMParser().parseFromString(slideXml, "text/xml");
  const paragraphs = Array.from(doc.getElementsByTagName("a:p"));
  const lines: string[] = [];
  for (const para of paragraphs) {
    const runs = Array.from(para.getElementsByTagName("a:t"));
    const line = runs.map((r) => textOf(r)).join("");
    const trimmed = line.trim();
    if (trimmed) lines.push(trimmed);
  }
  return lines;
}

/** First image relationship target for a slide, resolved to a zip path. */
function firstImagePath(relsXml: string | undefined): string | null {
  if (!relsXml) return null;
  const doc = new DOMParser().parseFromString(relsXml, "text/xml");
  const rels = Array.from(doc.getElementsByTagName("Relationship"));
  for (const rel of rels) {
    const type = rel.getAttribute("Type") ?? "";
    const target = rel.getAttribute("Target") ?? "";
    if (type.endsWith("/image") && target) {
      // Targets are relative to ppt/slides/, e.g. "../media/image1.png".
      const parts = ("ppt/slides/" + target).split("/");
      const resolved: string[] = [];
      for (const p of parts) {
        if (p === "..") resolved.pop();
        else if (p !== ".") resolved.push(p);
      }
      return resolved.join("/");
    }
  }
  return null;
}

/** Slide order from presentation.xml + its rels; falls back to filename sort. */
async function slideFileOrder(zip: JSZip): Promise<string[]> {
  const fallback = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = Number(a.match(/(\d+)/)?.[1] ?? 0);
      const nb = Number(b.match(/(\d+)/)?.[1] ?? 0);
      return na - nb;
    });

  try {
    const presXml = await zip.file("ppt/presentation.xml")?.async("string");
    const relsXml = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string");
    if (!presXml || !relsXml) return fallback;

    const relDoc = new DOMParser().parseFromString(relsXml, "text/xml");
    const relEls = Array.from(relDoc.getElementsByTagName("Relationship"));
    const ridToPath = new Map<string, string>();
    for (const rel of relEls) {
      const id = rel.getAttribute("Id");
      const target = rel.getAttribute("Target");
      if (id && target && target.includes("slides/")) ridToPath.set(id, "ppt/" + target.replace(/^\.?\//, ""));
    }

    const presDoc = new DOMParser().parseFromString(presXml, "text/xml");
    const sldIds = Array.from(presDoc.getElementsByTagName("p:sldId"));
    const ordered: string[] = [];
    for (const sld of sldIds) {
      const rid = sld.getAttribute("r:id");
      const path = rid ? ridToPath.get(rid) : undefined;
      if (path && zip.file(path)) ordered.push(path);
    }
    return ordered.length ? ordered : fallback;
  } catch {
    return fallback;
  }
}

const MAX_SLIDES = 300;

export async function parsePptx(buffer: Buffer, fallbackTitle: string): Promise<ParsedPptx> {
  const zip = await JSZip.loadAsync(buffer);

  let title = fallbackTitle;
  try {
    const coreXml = await zip.file("docProps/core.xml")?.async("string");
    if (coreXml) {
      const doc = new DOMParser().parseFromString(coreXml, "text/xml");
      const t = doc.getElementsByTagName("dc:title")[0];
      if (t && textOf(t)) title = textOf(t);
    }
  } catch {
    /* keep fallbackTitle */
  }

  const slidePaths = (await slideFileOrder(zip)).slice(0, MAX_SLIDES);
  const slides: ParsedPptxSlide[] = [];

  for (const path of slidePaths) {
    const xml = await zip.file(path)?.async("string");
    if (!xml) continue;
    const lines = extractLines(xml);
    const [heading = "", ...rest] = lines;

    const slideNum = path.match(/slide(\d+)\.xml$/)?.[1];
    const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
    const relsXml = await zip.file(relsPath)?.async("string");
    const imagePath = firstImagePath(relsXml);

    let image: ParsedPptxSlide["image"] = null;
    if (imagePath) {
      const entry = zip.file(imagePath);
      if (entry) {
        const data = await entry.async("uint8array");
        const ext = IMAGE_EXT_BY_CONTENT[imagePath.split(".").pop()?.toLowerCase() ?? ""] ?? "png";
        image = { data, ext };
      }
    }

    // Skip fully-empty slides (no text, no image) rather than importing blanks.
    if (!heading && !rest.length && !image) continue;
    slides.push({ heading, body: rest.join("\n"), image });
  }

  return { title, slides };
}
