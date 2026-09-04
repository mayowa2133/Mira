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

/**
 * Matches `GarmentImage` in `docs/05-api/openapi.yaml`.
 *
 * Snake_case, like the rest of the contract. This type previously used
 * camelCase and was correct — about the API, which was serving camelCase in
 * violation of its own spec. Both are fixed; the spec was always right.
 */
export type GarmentImage = {
  id: string;
  kind: string;
  /** Full-size original. Always present. */
  url: string;
  /** 400px. Null until image.process has run, or if derivatives failed. */
  thumb_url: string | null;
  /** 1080px. Same nullability. */
  medium_url: string | null;
  url_expires_at: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  is_canonical: boolean;
  position: number;
};

/**
 * The smallest image that will do.
 *
 * Falling back to the original is deliberate rather than defensive: a garment
 * photographed seconds ago has no derivatives yet, and showing the full-size
 * photo is far better than showing nothing (`image-processing.md` §8).
 */
export function imageSrc(
  image: GarmentImage | null | undefined,
  size: 'thumb' | 'medium',
): string | null {
  if (!image) return null;
  if (size === 'thumb') return image.thumb_url ?? image.medium_url ?? image.url;
  return image.medium_url ?? image.url;
}

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
 * Change status, optimistically.
 *
 * The status flips immediately and the previous value is captured, because
 * "undo, not confirm" needs something to undo TO — and after the mutation the
 * old value is gone (`docs/02-design/states-and-errors.md` — Destructive
 * actions).
 *
 * A failure rolls back visibly rather than leaving the UI asserting a status
 * the server never accepted.
 */
export function useSetStatus() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      request<Garment>(`/garments/${id}/status`, { method: 'POST', body: { status } }),

    onMutate: async ({ id, status }) => {
      await client.cancelQueries({ queryKey: ['garments'] });
      await client.cancelQueries({ queryKey: closetKeys.garment(id) });

      const previousLists = client.getQueriesData<GarmentPages>({ queryKey: ['garments'] });
      const previousDetail = client.getQueryData<Garment>(closetKeys.garment(id));

      // Captured before the write: this is what Undo restores.
      const previousStatus =
        previousDetail?.status ??
        previousLists
          .flatMap(([, data]) => data?.pages.flatMap((p) => p.data) ?? [])
          .find((g) => g.id === id)?.status ??
        null;

      const patch = (g: Garment) => (g.id === id ? { ...g, status } : g);

      for (const [key] of previousLists) {
        client.setQueryData<GarmentPages>(key, (old) =>
          old ? { ...old, pages: old.pages.map((p) => ({ ...p, data: p.data.map(patch) })) } : old,
        );
      }
      if (previousDetail) {
        client.setQueryData<Garment>(closetKeys.garment(id), { ...previousDetail, status });
      }

      return { previousLists, previousDetail, previousStatus, id };
    },

    onError: (_error, _vars, context) => {
      for (const [key, data] of context?.previousLists ?? []) client.setQueryData(key, data);
      if (context?.previousDetail) {
        client.setQueryData(closetKeys.garment(context.id), context.previousDetail);
      }
    },

    onSettled: (_data, _error, { id }) => {
      void client.invalidateQueries({ queryKey: ['garments'] });
      void client.invalidateQueries({ queryKey: closetKeys.garment(id) });
      void client.invalidateQueries({ queryKey: closetKeys.summary });
    },
  });
}

/**
 * Soft delete, paired with `useRestoreGarment` so removal is undoable.
 *
 * Removal is the one closet action that gets a CONFIRMATION rather than a bare
 * undo, because it reads as deletion — but it is a soft delete recoverable for
 * 30 days, and the confirmation says so
 * (`docs/07-security/data-retention.md`).
 */
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

/**
 * Create a garment.
 *
 * Every creating POST carries an Idempotency-Key, so a retry — a flaky network,
 * a double tap — cannot produce two garments
 * (`docs/05-api/api-contract.md` — Conventions).
 */
export function useCreateGarment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      request<Garment>('/garments', {
        method: 'POST',
        body: payload,
        idempotencyKey: globalThis.crypto.randomUUID(),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['garments'] });
      void client.invalidateQueries({ queryKey: closetKeys.summary });
    },
  });
}

/** Edit a garment. Never sends `source_type`: provenance is immutable (CAP-3). */
export function useUpdateGarment(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      request<Garment>(`/garments/${id}`, { method: 'PATCH', body: payload }),
    onSuccess: (garment) => {
      client.setQueryData(closetKeys.garment(id), garment);
      void client.invalidateQueries({ queryKey: ['garments'] });
      void client.invalidateQueries({ queryKey: closetKeys.summary });
    },
  });
}

/**
 * What Mira knows about each field, and how sure it is.
 *
 * Bands, never numbers (D-011). The screen renders a tick, a statement, a
 * question or an empty row — a user should never see "0.72", which invites
 * arguing with a number instead of correcting a value.
 */
export type ConfidenceBand = 'high' | 'medium' | 'low' | 'very_low';

export type GarmentAttribute = {
  field: string;
  value: unknown;
  band: ConfidenceBand;
  source: string;
  superseded: { value: unknown; band: ConfidenceBand; source: string } | null;
};

export function useGarmentAttributes(id: string) {
  return useQuery({
    queryKey: ['garment', id, 'attributes'],
    queryFn: () => request<{ data: GarmentAttribute[] }>(`/garments/${id}/attributes`),
    select: (response) => response.data,
    enabled: Boolean(id),
  });
}
