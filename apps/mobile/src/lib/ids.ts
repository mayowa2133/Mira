/**
 * Idempotency keys.
 *
 * `crypto.randomUUID()` is NOT available in Hermes. It is a Web Crypto API that
 * browsers and Node provide and React Native does not, and nothing in this app
 * polyfills it — so the one call site that used it threw a TypeError the moment
 * it ran on a device.
 *
 * That failure was close to invisible. The throw happened inside a TanStack
 * `mutationFn`, which turns any error into mutation state rather than a crash,
 * so creating a garment from the manual add form simply did nothing: no
 * request, no navigation, no red screen. Every test passed, because they call
 * the API directly and mint their own keys.
 *
 * A key only has to be unique per user per request. Time plus randomness is
 * ample, and it cannot throw.
 */
export function idempotencyKey(): string {
  const uuid = globalThis.crypto?.randomUUID;
  if (typeof uuid === 'function') return globalThis.crypto.randomUUID();

  const random = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random()}-${random()}`;
}
