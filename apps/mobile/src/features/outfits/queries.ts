/**
 * Outfits, looks and wear tracking.
 *
 * `wear` counts are derived server-side from wear_events, so nothing here
 * computes them — a client that incremented its own copy would disagree with
 * the closet the moment a wear was recorded from anywhere else.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/lib/api';

export type OutfitTab = 'saved' | 'worn' | 'mira' | 'mine';

export type OutfitItem = {
  garment_id: string;
  slot: string;
  position: number;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  image_url?: string | null;
};

export type Outfit = {
  id: string;
  name: string | null;
  occasion: string | null;
  season: string[];
  origin: string;
  favorite: boolean;
  items: OutfitItem[];
  wear: { count: number; last_worn_at: string | null };
  created_at: string;
  updated_at: string;
};

export function useOutfits(tab: OutfitTab) {
  return useQuery({
    queryKey: ['outfits', tab],
    queryFn: () => request<{ data: Outfit[] }>(`/outfits?tab=${tab}`),
    select: (response) => response.data,
  });
}

export function useOutfit(id: string) {
  return useQuery({
    queryKey: ['outfit', id],
    queryFn: () => request<Outfit>(`/outfits/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateOutfit() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      name: string | null;
      occasion: string | null;
      items: { garment_id: string; slot: string }[];
    }) =>
      request<Outfit>('/outfits', {
        method: 'POST',
        body: input,
        idempotencyKey: `outfit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['outfits'] });
    },
  });
}

export function useToggleOutfitFavorite() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) =>
      request<Outfit>(`/outfits/${id}/favorite`, { method: 'POST', body: { favorite } }),
    onSuccess: (_data, variables) => {
      void client.invalidateQueries({ queryKey: ['outfits'] });
      void client.invalidateQueries({ queryKey: ['outfit', variables.id] });
    },
  });
}

/**
 * Record a wear.
 *
 * Invalidates the closet too: wearing a look changes worn_count and
 * last_worn_at on every garment in it, and a stale grid would show the user
 * numbers they just disproved.
 */
export function useRecordWear() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: { garment_id?: string; outfit_id?: string; worn_on?: string }) =>
      request<{ created: number; ids: string[] }>('/wear-events', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['outfits'] });
      void client.invalidateQueries({ queryKey: ['outfit'] });
      void client.invalidateQueries({ queryKey: ['garments'] });
      void client.invalidateQueries({ queryKey: ['garment'] });
    },
  });
}

export function useDeleteOutfit() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => request<void>(`/outfits/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['outfits'] });
    },
  });
}
