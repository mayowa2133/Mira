import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * Development-only initial-route override.
 *
 * Verification needs to land on a specific screen deterministically. Deep links
 * are the natural way, but iOS shows an "Open in Mira?" confirmation for custom
 * schemes opened from outside the app, and `simctl` cannot dismiss it.
 *
 * Setting `EXPO_PUBLIC_DEV_INITIAL_ROUTE` navigates there once on mount:
 *
 *   EXPO_PUBLIC_DEV_INITIAL_ROUTE=/closet npx expo start
 *
 * SAFETY
 * - Gated on `__DEV__`, so it is inert in any release build.
 * - Runs exactly once, so it never fights real navigation.
 *
 * Delete this alongside `dev-auth.ts` once there is a sign-in flow and a
 * simulator-driving setup that can tap.
 */
export function useDevInitialRoute(): void {
  const router = useRouter();

  useEffect(() => {
    if (!__DEV__) return;

    const route = process.env.EXPO_PUBLIC_DEV_INITIAL_ROUTE;
    if (!route) return;

    // Let the navigator mount before replacing, or the push is dropped.
    const timer = setTimeout(() => {
      router.replace(route as Parameters<typeof router.replace>[0]);
    }, 400);

    return () => clearTimeout(timer);
    // Intentionally runs once: this is a launch affordance, not reactive state.
    // (The react-hooks plugin is not configured in this repo, so no disable
    // directive is needed — and an unknown one is itself a lint error.)
  }, [router]);
}
