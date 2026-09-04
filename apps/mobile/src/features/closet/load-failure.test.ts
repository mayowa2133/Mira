import { describe, expect, it } from 'vitest';
import { describeLoadFailure } from './load-failure';

/**
 * A stand-in for `ApiError`.
 *
 * Importing the real one drags in `@/lib/api` → `expo-constants` →
 * React Native, which vitest cannot parse. `describeLoadFailure` reads the
 * error by shape for exactly this reason, so this is the same contract.
 */
class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

describe('describing a failure to load', () => {
  it('says nothing when nothing failed', () => {
    // The only route to an empty state: a screen may not reach one while this
    // returns a failure.
    expect(describeLoadFailure(null)).toBeNull();
    expect(describeLoadFailure(undefined)).toBeNull();
  });

  it('treats offline as a condition, not a fault', () => {
    const offline = describeLoadFailure(new ApiError(0, 'offline', 'no network'));
    expect(offline?.message).toBe("You're offline.");
    expect(offline?.hint).toBe("We'll finish this when you're back.");
  });

  it('names an ended session rather than an empty closet', () => {
    // The bug this module exists for: every request 401ing rendered as "Let's
    // find what you already own."
    const expired = describeLoadFailure(
      new ApiError(401, 'token_expired', 'Please sign in again.'),
    );
    expect(expired?.message).toBe('Please sign in again.');
  });

  it('recognizes a session problem by status even with an unfamiliar code', () => {
    expect(describeLoadFailure(new ApiError(401, 'something_new', 'nope'))?.message).toBe(
      'Please sign in again.',
    );
  });

  it('carries the server’s own words as the hint, never as the headline', () => {
    const failure = describeLoadFailure(
      new ApiError(500, 'internal', 'Something went wrong on our side.'),
    );
    expect(failure?.message).toBe("We couldn't load your closet.");
    expect(failure?.hint).toBe('Something went wrong on our side.');
  });

  it('handles an error that is not an ApiError at all', () => {
    const failure = describeLoadFailure(new TypeError('undefined is not a function'));
    expect(failure?.message).toBe("We couldn't load your closet.");
    // A stack trace or a raw message must never be the primary copy.
    expect(failure?.hint).toBe('Something went wrong on our side.');
  });

  it('always offers a way forward', () => {
    for (const error of [
      new ApiError(0, 'offline', ''),
      new ApiError(401, 'token_expired', ''),
      new ApiError(500, 'internal', ''),
      new Error('boom'),
    ]) {
      expect(describeLoadFailure(error)?.actionLabel).toBe('Try again');
    }
  });

  it('names what failed when it is not the closet', () => {
    expect(describeLoadFailure(new Error('x'), 'your looks')?.message).toBe(
      "We couldn't load your looks.",
    );
  });
});

describe('per-screen wording', () => {
  const serverError = new ApiError(500, 'internal', 'Something went wrong on our side.');

  it('takes a subject as a bare string, for the common case', () => {
    expect(describeLoadFailure(serverError, 'your looks')?.message).toBe(
      "We couldn't load your looks.",
    );
  });

  it('takes a whole headline for a screen that reads better in its own words', () => {
    expect(
      describeLoadFailure(serverError, { message: "We couldn't look through your closet." })
        ?.message,
    ).toBe("We couldn't look through your closet.");
  });

  it('does not let a screen reword offline or an ended session', () => {
    // These say the same thing everywhere. Sharing them is the point; a screen
    // inventing its own phrasing for "you are offline" is how the copy drifted
    // into three places to begin with.
    const custom = { message: 'Custom headline.' };
    expect(describeLoadFailure(new ApiError(0, 'offline', ''), custom)?.message).toBe(
      "You're offline.",
    );
    expect(describeLoadFailure(new ApiError(401, 'token_expired', ''), custom)?.message).toBe(
      'Please sign in again.',
    );
  });
});
