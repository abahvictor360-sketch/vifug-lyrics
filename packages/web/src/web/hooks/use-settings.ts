import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export type AppSettings = {
  activeThemeId: string | null;
  linesPerSlide: number;
  paginatorMode: "fixed" | "manual" | "autofit";
  songDisplayLang: string | null;
  dualLanguage: boolean;
  secondaryLang: string | null;
  autoFollow: boolean;
  activeBackgroundId?: string | null;
  /**
   * Which non-English Bible language packs are enabled. English core
   * (kjv/web/asv/bbe) is always available. Missing = default (all on).
   */
  bibleLangs?: { yor: boolean; hau: boolean; ibo: boolean };
  /**
   * Per-display Bible overrides layered over the active lyric theme.
   * Any field left null/undefined inherits the lyric theme.
   */
  bibleTheme?: {
    bgColor?: string | null;
    textColor?: string | null;
    textAlign?: "left" | "center" | "right" | null;
    fontWeight?: number | null;
    fontSize?: number | null;
  } | null;
  output: { displayId: number | null; resolution: string };
  ui: { language: string };
};

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await api.settings.$get();
      const data = await res.json();
      return data.config as AppSettings;
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: AppSettings) => {
      const res = await api.settings.$put({ json: { config } });
      return res.json();
    },
    onMutate: async (config) => {
      await qc.cancelQueries({ queryKey: ["settings"] });
      const prev = qc.getQueryData<AppSettings>(["settings"]);
      qc.setQueryData(["settings"], config);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["settings"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}
