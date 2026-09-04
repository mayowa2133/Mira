/**
 * Wardrobe insights and stats.
 *
 * The server decides what is worth saying — an insight the closet cannot
 * support is omitted rather than returned empty (D-022 reasoning, and
 * screen-specs.md §26: "fashion content, not a dashboard"). So the client
 * renders whatever arrives and never asks "is this one big enough to show?".
 */
import { useQuery } from '@tanstack/react-query';
import { request } from '@/lib/api';

export type InsightKind = 'forgotten' | 'never_worn' | 'tags_attached' | 'most_loved';

export type InsightGarment = {
  id: string;
  name: string | null;
  brand: string | null;
  category: string;
  image_url: string | null;
  worn_count: number;
  last_worn_at: string | null;
  cost_per_wear: { amount: number; currency: string } | null;
};

export type Insight = {
  kind: InsightKind;
  headline: string;
  /** How many qualify; `garments` is a preview of them. */
  total: number;
  garments: InsightGarment[];
};

export function useInsights(kinds?: InsightKind[]) {
  const query = kinds?.length ? `?kinds=${kinds.join(',')}` : '';

  return useQuery({
    queryKey: ['wardrobe', 'insights', kinds ?? 'all'],
    queryFn: () => request<{ data: Insight[] }>(`/wardrobe/insights${query}`),
    select: (response) => response.data,
  });
}

export type WardrobeStats = {
  closet_value: {
    total: number;
    currency: string | null;
    priced_pieces: number;
    unpriced_pieces: number;
  };
  cost_per_wear: { average: number | null; currency: string | null; based_on_pieces: number };
};

export function useWardrobeStats() {
  return useQuery({
    queryKey: ['wardrobe', 'stats'],
    queryFn: () => request<WardrobeStats>('/wardrobe/stats'),
  });
}
