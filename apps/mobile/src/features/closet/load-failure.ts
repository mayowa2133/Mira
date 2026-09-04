/**
 * What to say when a screen could not load its content
 * (`docs/02-design/states-and-errors.md` — Error taxonomy).
 *
 * Pulled out of the screens because the failure Home had was not a missing
 * error state — it was an error rendered as an EMPTY one. `total` was read as
 * `summary.data?.total ?? 0`, so a request that never returned looked exactly
 * like a closet with nothing in it, and the user was invited to start adding
 * clothes they already owned.
 *
 * The two are opposites: empty means "we know, and there is nothing"; error
 * means "we do not know". Deciding between them by counting is what let them be
 * confused, so this returns null when there is no error, and a screen may only
 * reach its empty state through that null.
 *
 * The error is read by shape rather than with `instanceof ApiError`, which
 * keeps this module free of `@/lib/api` and therefore of React Native — the
 * reason it can be unit-tested at all — and survives an error that crossed a
 * module boundary.
 */
export type LoadFailure = {
  message: string;
  hint: string;
  /** Every error message states what the user can do next. */
  actionLabel: string;
};

type ApiShaped = { status: number; code: string; message: string };

function asApiError(error: unknown): ApiShaped | null {
  if (typeof error !== 'object' || error === null) return null;
  const candidate = error as Partial<ApiShaped>;
  return typeof candidate.status === 'number' && typeof candidate.code === 'string'
    ? { status: candidate.status, code: candidate.code, message: candidate.message ?? '' }
    : null;
}

/** Codes that mean the session, not the request, is the problem. */
const SESSION_CODES = new Set([
  'unauthenticated',
  'token_expired',
  'token_invalid',
  'account_deleted',
]);

/** `ApiError` uses status 0 for "the request never left the device". */
const OFFLINE = 0;

export function describeLoadFailure(error: unknown, subject = 'your closet'): LoadFailure | null {
  if (!error) return null;

  const api = asApiError(error);

  // Offline is not a failure, it is a condition. The wording says what happens
  // next rather than what went wrong, because nothing did.
  if (api?.status === OFFLINE) {
    return {
      message: "You're offline.",
      hint: "We'll finish this when you're back.",
      actionLabel: 'Try again',
    };
  }

  // Authorization routes to sign-in — except there is no sign-in screen yet
  // (task 0.5), so this says what happened and offers the only thing that can
  // help, rather than a button leading nowhere.
  if (api && (SESSION_CODES.has(api.code) || api.status === 401)) {
    return {
      message: 'Please sign in again.',
      hint: 'Your session has ended.',
      actionLabel: 'Try again',
    };
  }

  return {
    message: `We couldn't load ${subject}.`,
    // Never a raw provider error, stack trace or bare code as primary copy. The
    // API's own messages are written to be shown; anything else is not.
    hint: api?.message || 'Something went wrong on our side.',
    actionLabel: 'Try again',
  };
}
