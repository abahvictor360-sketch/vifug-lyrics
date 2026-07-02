import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export type MediaItem = {
  id: string;
  type: "image" | "video" | "color";
  uri: string;
  url: string;
  loop: number | null;
  fit: string | null;
  createdAt: string;
};

export function useMedia() {
  return useQuery({
    queryKey: ["media"],
    queryFn: async () => {
      const res = await api.media.$get();
      const data = await res.json();
      return data.media as MediaItem[];
    },
  });
}

/** Upload a file to Tigris/S3 via presigned URL, then register a media record. */
export async function uploadMediaFile(file: File): Promise<MediaItem> {
  const presign = await api.media.presign.$post({
    json: { filename: file.name, contentType: file.type },
  });
  const { url, key } = await presign.json();
  await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  const type = file.type.startsWith("video") ? "video" : "image";
  const res = await api.media.$post({ json: { type, uri: key, fit: "cover", loop: true } });
  const data = await res.json();
  return data.media as MediaItem;
}

export function useAddMediaUrl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { type: "image" | "video" | "color"; uri: string }) => {
      const res = await api.media.$post({
        json: { type: input.type, uri: input.uri, fit: "cover", loop: true },
      });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });
}

export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.media[":id"].$delete({ param: { id } });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });
}

export function useUploadMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadMediaFile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });
}
