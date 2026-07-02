import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export type Playlist = {
  id: string;
  name: string;
  serviceDate: string | null;
  createdAt: string;
};

export type PlaylistItemType = "song" | "scripture" | "blank" | "header";

export type PlaylistItem = {
  id: string;
  playlistId: string;
  itemType: PlaylistItemType;
  songId: string | null;
  arrangementId: string | null;
  scriptureRef: string | null;
  scriptureVersion: string | null;
  label: string | null;
  orderIndex: number;
};

/** A plan item the UI edits before it is persisted. */
export type DraftItem = {
  itemType: PlaylistItemType;
  songId?: string | null;
  scriptureRef?: string | null;
  scriptureVersion?: string | null;
  label?: string | null;
};

export function usePlaylists() {
  return useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      const res = await api.playlists.$get();
      const data = await res.json();
      return data.playlists as Playlist[];
    },
  });
}

export function usePlaylist(id: string | null) {
  return useQuery({
    queryKey: ["playlist", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.playlists[":id"].$get({ param: { id: id! } });
      const data = await res.json();
      return data as { playlist: Playlist; items: PlaylistItem[] };
    },
  });
}

export function useCreatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; serviceDate?: string }) => {
      const res = await api.playlists.$post({ json: input });
      return (await res.json()) as { id: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlists"] }),
  });
}

export function useRenamePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; serviceDate?: string | null }) => {
      const { id, ...patch } = input;
      await api.playlists[":id"].$patch({ param: { id }, json: patch });
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["playlists"] });
      qc.invalidateQueries({ queryKey: ["playlist", v.id] });
    },
  });
}

export function useDeletePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.playlists[":id"].$delete({ param: { id } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlists"] }),
  });
}

export function useSavePlaylistItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; items: DraftItem[] }) => {
      await api.playlists[":id"].items.$put({
        param: { id: input.id },
        json: { items: input.items },
      });
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["playlist", v.id] }),
  });
}
