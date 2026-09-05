import { useEffect, useRef } from 'react';
import { useRootNavigationState, useRouter } from 'expo-router';
import { ApiError } from '@/lib/api';
import { useMe } from '@/features/identity/queries';
import { launchRoute } from './state';

/**
 * Send a launching app where it belongs (§1, `navigation.md` rule 7).
 *
 * Runs once. Onboarding is exited rather than popped, so this uses `replace`
 * and never pushes — a user who finishes onboarding must not be able to swipe
 * back into it.
 *
 * Waits on `useRootNavigationState().key` rather than a timer. That is the
 * actual condition, and B-3 is the standing reminder of what happens when a
 * navigation is fired on a guess instead: it worked for top-level routes,
 * silently did nothing for nested ones, and the harness was mistaken for the
 * thing it was verifying.
 */
export function useLaunchRoute(): void {
  const router = useRouter();
  const rootState = useRootNavigationState();
  const me = useMe();
  const navigated = useRef(false);

  useEffect(() => {
    if (navigated.current) return;
    // No key means the root navigator has not mounted, so there is nothing to
    // navigate.
    if (!rootState?.key) return;

    // A 401 is an answer — signed out — not a failure to wait on.
    const signedOut = me.error instanceof ApiError && me.error.status === 401;
    if (me.isLoading && !signedOut) return;

    // Any other error means the server did not answer, which is not the same
    // as answering "nobody". Without this, opening Mira offline sends a
    // returning user into the new-user welcome flow.
    const unreachable = Boolean(me.error) && !signedOut;

    const route = launchRoute({
      isLoading: false,
      isSignedIn: !signedOut && Boolean(me.data),
      state: me.data?.onboarding_state,
      reachable: !unreachable,
    });
    if (!route) return;

    navigated.current = true;
    // Home is where the app already starts; replacing with it would be a
    // pointless navigation that also discards any deep link.
    if (route === '/') return;

    router.replace(route as Parameters<typeof router.replace>[0]);
  }, [rootState?.key, router, me.isLoading, me.data, me.error]);
}
