import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/lib/api';

/** Matches `PurchaseCandidate` in the API contract. */
export type PurchaseCandidate = {
  id: string;
  source: { type: string; id: string };
  retailer: string | null;
  order_number: string | null;
  purchase_date: string | null;
  price: { amount: number; currency: string } | null;
  raw_item_name: string;
  product_name: string | null;
  brand: string | null;
  image_url: string | null;
  status: string;
  linked_garment_id: string | null;
};

const keys = {
  list: (status?: string[]) => ['purchase-candidates', status ?? 'reviewable'] as const,
};

export function usePurchaseCandidates(status?: string[]) {
  const query = status?.length ? `?limit=100&status=${status.join('&status=')}` : '?limit=100';
  return useQuery({
    queryKey: keys.list(status),
    queryFn: () =>
      request<{ data: PurchaseCandidate[]; total: number }>(`/purchase-candidates${query}`),
  });
}

/**
 * Answer the ownership question for one candidate.
 *
 * Not optimistic. Confirming creates a garment and runs duplicate detection,
 * either of which can legitimately refuse — showing it as done and then taking
 * it back would be worse than the moment's wait.
 */
export function useAnswerCandidate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      request<PurchaseCandidate>(`/purchase-candidates/${id}`, {
        method: 'PATCH',
        body: { status },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['purchase-candidates'] });
      void client.invalidateQueries({ queryKey: ['garments'] });
      void client.invalidateQueries({ queryKey: ['closet', 'summary'] });
    },
  });
}

/** Answer many at once. Reports both halves (A-03). */
export function useAnswerMany() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      request<{ updated: PurchaseCandidate[]; failed: { id: string; reason: string }[] }>(
        '/purchase-candidates/bulk',
        { method: 'POST', body: { ids, status } },
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['purchase-candidates'] });
      void client.invalidateQueries({ queryKey: ['garments'] });
      void client.invalidateQueries({ queryKey: ['closet', 'summary'] });
    },
  });
}
