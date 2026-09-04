import { useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/lib/api';
import { setAuthToken } from '@/lib/api';

/**
 * Sign out (`auth-contract.md` — Sign-out).
 *
 * Three things, and the order matters. Revoke at the provider first, because
 * that is the only one that can fail meaningfully. Then clear the token. Then
 * clear the cache — including cached garment images, because a shared device
 * must not leak the previous user's closet, and that is the half the server
 * cannot do.
 */
export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => request<void>('/auth/session', { method: 'DELETE' }),
    onSuccess: () => {
      setAuthToken(null);
      client.clear();
    },
  });
}

/** Request account deletion. 202 — the teardown runs as a job. */
export function useDeleteAccount() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      request<{ deletion_id: string; status: string }>('/auth/account', { method: 'DELETE' }),
    onSuccess: () => {
      // The account is going; nothing cached about it should outlive the
      // request, whatever the job does next.
      setAuthToken(null);
      client.clear();
    },
  });
}
