import { setAuthToken } from './api';

/**
 * Development-only auth bootstrap.
 *
 * Real sign-in (Apple, Google, email) is task 0.5 and is not built on the
 * client yet — the API side exists and is tested, but there is no login screen.
 * Without a token every request 401s, so the closet screens could only ever be
 * seen in their error state.
 *
 * This reads a token minted by the local dev verifier so the real screens can
 * be exercised against the real API.
 *
 * SAFETY
 * - Gated on `__DEV__`, so it is inert in any release build.
 * - The token is supplied by the developer's environment, never committed.
 * - The local dev verifier itself cannot run outside MIRA_ENV=local:
 *   `loadEnv` refuses to start with DEV_AUTH_SECRET set anywhere else
 *   (`apps/api/src/config/env.ts`).
 *
 * Delete this module when 0.5 lands a real sign-in screen.
 */
export function bootstrapDevAuth(): void {
  if (!__DEV__) return;

  const token = process.env.EXPO_PUBLIC_DEV_AUTH_TOKEN;
  if (!token) return;

  setAuthToken(token);
}
