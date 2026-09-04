import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/lib/api';
import type { OnboardingState } from '@/features/onboarding/state';

/**
 * Who is signed in (`docs/05-api/api-contract.md` — Auth).
 *
 * Drives the launch decision, so it is deliberately NOT retried: a 401 here
 * means signed out, which is an answer rather than a failure, and retrying it
 * only delays the welcome screen behind three round trips.
 */
export type Me = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  onboarding_state: OnboardingState;
  auto_import_enabled: boolean;
  closet_id: string;
};

export const identityKeys = { me: ['auth', 'me'] as const };

export function useMe() {
  return useQuery({
    queryKey: identityKeys.me,
    queryFn: () => request<Me>('/auth/me'),
    retry: false,
    // The answer changes only on sign-in or sign-out, both of which invalidate
    // this key explicitly.
    staleTime: 5 * 60 * 1000,
  });
}

/** Record how far onboarding got. The server owns this value. */
export function useSetOnboardingState() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (state: OnboardingState) =>
      request<{ onboarding_state: OnboardingState }>('/auth/me', {
        method: 'PATCH',
        body: { onboarding_state: state },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: identityKeys.me });
    },
  });
}
