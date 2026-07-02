import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export type Translation = {
  id: string;
  sectionId: string;
  lang: string;
  lyrics: string;
  source: string;
};

export const LANGS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ido", label: "Idoma" },
  { code: "yo", label: "Yoruba" },
  { code: "ig", label: "Igbo" },
  { code: "ha", label: "Hausa" },
  { code: "tw", label: "Twi" },
];

export function langLabel(code: string | null | undefined): string {
  if (!code) return "";
  return LANGS.find((l) => l.code === code)?.label ?? code;
}

export function useTranslations(songId: string | null) {
  return useQuery({
    queryKey: ["translations", songId],
    enabled: !!songId,
    queryFn: async () => {
      const res = await api.songs[":id"].translations.$get({ param: { id: songId! } });
      const data = await res.json();
      return data.translations as Translation[];
    },
  });
}

export function useSaveTranslation(songId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sectionId: string; lang: string; lyrics: string }) => {
      const res = await api.sections[":sectionId"].translations[":lang"].$put({
        param: { sectionId: input.sectionId, lang: input.lang },
        json: { lyrics: input.lyrics, source: "human" },
      });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["translations", songId] }),
  });
}
