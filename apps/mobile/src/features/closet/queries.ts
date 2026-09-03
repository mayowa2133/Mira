/**
 * Closet server state.
 *
 * TanStack Query is the cache; there is no global store for server data
 * (`docs/03-architecture/frontend-architecture.md` §3).
 *
 * Query keys match the documented shape so invalidation stays predictable.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { request, toQuery } from '@/lib/api';

export type GarmentImage = {
  id: string;
  kind: string;
  url: string;
  urlExpiresAt: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  isCanonical: boolean;
  position: number;
};

export type Garment = {
  id: string;
  name: string | null;
  brand: { id: string; name: string } | null;
  brand_raw: string | null;
  category: string;
  subcategory: string | null;
  primary_color: string | null;
  secondary_colors: string[];
  pattern: string | null;
  materials: string[];
  size: { raw: string | null; normalized: string | null; system: string | null };
  season: string[];
  occasion: string[];
  style_tags: string[];
  purchase: {
    date: string | null;
    price: { amount: number; currency: string } | null;
    retailer: string | null;
  };
  identifiers: { sku: string | null; barcode: string | null; product_url: string | null };
  source: { type: string; reference: string | null };
  status: string;
  favorite: boolean;
  tags_attached: boolean | null;
  notes: string | null;
  wear: {
    count: number;
    last_worn_at: string | null;
    cost_per_wear: { amount: number; currency: string } | null;
  };
  images: GarmentImage[];
  canonical_image: GarmentImage | null;
  analysis_state: string;
  created_at: string;
};

export type GarmentPage = { data: Garment[]; next_cursor: string | null };

export type ClosetSummary = {
  total: number;
  by_category: { category: string; count: number }[];
  recently_added: Garment[];
};

export type ClosetFilters = {
  category?: string[];
  color?: string[];
  season?: string[];
  occasion?: string[];
  status?: string[];
  favorite?: boolean;
  never_worn?: boolean;
  tags_attached?: boolean;
  sort?: string;
};

export const closetKeys = {
  summary: ['closet', 'summary'] as const,
  garments: (filters: ClosetFilters) => ['garments', filters] as const,
  garment: (id: string) => ['garment', id] as const,
  count: (filters: ClosetFilters) => ['garments', 'count', filters] as const,
};

const PAGE_SIZE = 40;

export function useClosetSummary() {
  return useQuery({
    queryKey: closetKeys.summary,
    queryFn: () => request<ClosetSummary>('/closet'),
  });
}

/** The closet grid. Paged, because the closet is the largest list Mira has. */
export function useGarments(filters: ClosetFilters = {}) {
  return useInfiniteQuery({
    queryKey: closetKeys.garments(filters),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      request<GarmentPage>(
        `/garments${toQuery({ ...filters, limit: PAGE_SIZE, cursor: pageParam })}`,
      ),
    getNextPageParam: (last) => last.next_cursor,
  });
}

export function useGarment(id: string) {
  return useQuery({
    queryKey: closetKeys.garment(id),
    queryFn: () => request<Garment>(`/garments/${id}`),
    enabled: Boolean(id),
  });
}

/** Live count for the filter sheet's "Show N items" CTA. */
export function useGarmentCount(filters: ClosetFilters) {
  return useQuery({
    queryKey: closetKeys.count(filters),
    queryFn: () => request<{ count: number }>(`/garments/count${toQuery(filters)}`),
  });
}

type GarmentPages = InfiniteData<GarmentPage, string | null>;

/**
 * Favourite, optimistically.
 *
 * The heart fills immediately; a failure rolls back visibly rather than leaving
 * the UI lying about server state (`docs/02-design/ux-principles.md` §
 * Interaction conventions).
 */
export function useToggleFavorite() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) =>
      request<Garment>(`/garments/${id}/favorite`, { method: 'POST', body: { favorite } }),

    onMutate: async ({ id, favorite }) => {
      await client.cancelQueries({ queryKey: ['garments'] });
      await client.cancelQueries({ queryKey: closetKeys.garment(id) });

      const previousLists = client.getQueriesData<GarmentPages>({ queryKey: ['garments'] });
      const previousDetail = client.getQueryData<Garment>(closetKeys.garment(id));

      const patch = (g: Garment) => (g.id === id ? { ...g, favorite } : g);

      for (const [key] of previousLists) {
        client.setQueryData<GarmentPages>(key, (old) =>
          old ? { ...old, pages: old.pages.map((p) => ({ ...p, data: p.data.map(patch) })) } : old,
        );
      }
      if (previousDetail) {
        client.setQueryData<Garment>(closetKeys.garment(id), { ...previousDetail, favorite });
      }

      return { previousLists, previousDetail, id };
    },

    onError: (_error, _vars, context) => {
      // Roll back everything this mutation touched.
      for (const [key, data] of context?.previousLists ?? []) client.setQueryData(key, data);
      if (context?.previousDetail) {
        client.setQueryData(closetKeys.garment(context.id), context.previousDetail);
      }
    },

    onSettled: (_data, _error, { id }) => {
      void client.invalidateQueries({ queryKey: closetKeys.garment(id) });
    },
  });
}

/**
 * Change status.
 *
 * Optimistic, with the previous status returned so the caller can offer Undo
 * rather than a confirmation (`docs/02-design/states-and-errors.md` —
 * Destructive actions: undo, not confirm, wherever reversible).
 */
export function useSetStatus() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      request<Garment>(`/garments/${id}/status`, { method: 'POST', body: { status } }),
    onSettled: (_data, _error, { id }) => {
      void client.invalidateQueries({ queryKey: ['garments'] });
      void client.invalidateQueries({ queryKey: closetKeys.garment(id) });
      void client.invalidateQueries({ queryKey: closetKeys.summary });
    },
  });
}

/** Soft delete, paired with `useRestoreGarment` so removal is undoable. */
export function useRemoveGarment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<void>(`/garments/${id}`, { method: 'DELETE' }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['garments'] });
      void client.invalidateQueries({ queryKey: closetKeys.summary });
    },
  });
}

export function useRestoreGarment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<Garment>(`/garments/${id}/restore`, {
        method: 'POST',
        idempotencyKey: `restore-${id}`,
      }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['garments'] });
      void client.invalidateQueries({ queryKey: closetKeys.summary });
    },
  });
}
