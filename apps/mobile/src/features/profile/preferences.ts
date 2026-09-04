import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/lib/api';
import type { StylePreferences } from './preferences-core';

export * from './preferences-core';

const key = ['preferences', 'style'] as const;

export function useStylePreferences() {
  return useQuery({
    queryKey: key,
    queryFn: () => request<StylePreferences>('/preferences/style'),
  });
}

export function useSaveStylePreferences() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: StylePreferences) =>
      request<StylePreferences>('/preferences/style', { method: 'PUT', body }),
    onSuccess: (saved) => {
      client.setQueryData(key, saved);
    },
  });
}
