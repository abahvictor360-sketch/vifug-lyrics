import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

/**
 * The operator's own fonts: files they added, kept with the library.
 *
 * A font only draws once the page has loaded it, and the page that draws the
 * words is rarely the one where the font was chosen - it is the projector
 * window, the stream overlay, a phone used as a screen. So every surface
 * registers every uploaded font (useCustomFontFaces, mounted at the app root)
 * and the browser fetches a file the first time something actually uses it.
 */

export type CustomFont = { id: string; name: string };

/** The CSS font-family value that selects an uploaded font. */
export function customFontValue(name: string): string {
  return `"${name}", system-ui, sans-serif`;
}

export function useCustomFonts() {
  return useQuery({
    queryKey: ["fonts"],
    queryFn: async () => {
      const res = await api.fonts.$get();
      return (await res.json()).fonts as CustomFont[];
    },
    // Another device may have added one; screens pick it up without a reload.
    refetchInterval: 30_000,
  });
}

const MIME: Record<string, string> = { ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2" };

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function useAddFont() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!MIME[ext]) throw new Error("Choose a .ttf, .otf, .woff or .woff2 font file.");
      if (file.size > 6_000_000) throw new Error("That font file is too large (the limit is about 6 MB).");
      // The file name, tidied, is the font's name in the list.
      const name = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/["\\<>]/g, "").trim() || "My font";
      const res = await api.fonts.$post({ json: { name, mime: MIME[ext], data: await toBase64(file) } } as never);
      const data = (await res.json()) as { id?: string; name?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error || "The font could not be added.");
      return { id: data.id, name: data.name ?? name };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fonts"] }),
  });
}

export function useDeleteFont() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.fonts[":id"].$delete({ param: { id } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fonts"] }),
  });
}

/** Registers an @font-face for every uploaded font. Mount once per page. */
export function useCustomFontFaces() {
  const fonts = useCustomFonts().data;
  useEffect(() => {
    if (!fonts) return;
    let el = document.getElementById("vifug-custom-fonts") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "vifug-custom-fonts";
      document.head.appendChild(el);
    }
    el.textContent = fonts
      .map((f) => `@font-face { font-family: "${f.name.replace(/["\\]/g, "")}"; src: url("/api/fonts/${f.id}/file"); font-display: swap; }`)
      .join("\n");
  }, [fonts]);
}

export function CustomFontFaces() {
  useCustomFontFaces();
  return null;
}
