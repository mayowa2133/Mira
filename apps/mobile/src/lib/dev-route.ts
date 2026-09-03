import { useEffect, useRef } from 'react';
import { useRootNavigationState, useRouter } from 'expo-router';

/**
 * Development-only initial-route override.
 *
 * Verification needs to land on a specific screen deterministically. Deep links
 * are the natural way, but iOS shows an "Open in Mira?" confirmation for custom
 * schemes opened from outside the app, and `simctl` cannot dismiss it.
 *
 *   EXPO_PUBLIC_DEV_INITIAL_ROUTE=/closet npx expo start
 *
 * Waiting for the navigator, not for a timer: an earlier version fired
 * `replace` on a 400ms timeout, which worked for routes declared as
 * `<Stack.Screen>` and SILENTLY DID NOTHING for nested ones like
 * `/add/manual`. That looked like a routing defect in the app for a while —
 * it was this. `useRootNavigationState()` only has a `key` once the root
 * navigator has mounted and registered its routes, which is the actual
 * condition being waited on.
 *
 * SAFETY
 * - Gated on `__DEV__`, so it is inert in any release build.
 * - Navigates exactly once, so it never fights real navigation.
 *
 * Delete this alongside `dev-auth.ts` once there is a sign-in flow.
 */
export function useDevInitialRoute(): void {
  const router = useRouter();
  const rootState = useRootNavigationState();
  const navigated = useRef(false);

  useEffect(() => {
    if (!__DEV__) return;
    if (navigated.current) return;

    // No key means the root navigator has not mounted yet.
    if (!rootState?.key) return;

    const route = process.env.EXPO_PUBLIC_DEV_INITIAL_ROUTE;
    if (!route) return;

    navigated.current = true;
    router.replace(route as Parameters<typeof router.replace>[0]);
  }, [rootState?.key, router]);
}
