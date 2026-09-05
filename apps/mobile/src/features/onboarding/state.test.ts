import { describe, expect, it } from 'vitest';
import { CLOSET_ROUTES, VALUE_CARDS, launchRoute, nextStep } from './state';

describe('where launch sends you', () => {
  it('decides nothing while it is still loading', () => {
    // §1 gives the splash up to 900 ms. Routing on an unknown answer is how a
    // signed-in user gets a flash of the welcome screen.
    expect(launchRoute({ isLoading: true, isSignedIn: true, state: 'completed' })).toBeNull();
  });

  it('does not mistake an unreachable server for a signed-out user', () => {
    // Signed-in is decided by asking the server, so a dropped connection looks
    // exactly like a real sign-out. Routing on that sends a RETURNING user
    // into the new-user welcome flow because their train went into a tunnel —
    // and Mira is meant to work offline (the airplane-mode capture criterion
    // says so outright).
    expect(
      launchRoute({ isLoading: false, isSignedIn: false, state: undefined, reachable: false }),
    ).toBeNull();
  });

  it('still ignores cached state when the server is unreachable', () => {
    // Staying put is not the same as trusting what we last saw: it navigates
    // nowhere, so whatever the app already shows keeps showing.
    expect(
      launchRoute({ isLoading: false, isSignedIn: false, state: 'completed', reachable: false }),
    ).toBeNull();
  });

  it('treats a reachable server the same as before', () => {
    // The flag is opt-in: every existing caller and case is unchanged.
    expect(
      launchRoute({ isLoading: false, isSignedIn: false, state: undefined, reachable: true }),
    ).toBe('/onboarding/welcome');
  });

  it('sends a signed-out visitor to Welcome', () => {
    expect(launchRoute({ isLoading: false, isSignedIn: false, state: undefined })).toBe(
      '/onboarding/welcome',
    );
  });

  it('ignores stale cached state when signed out', () => {
    // The previous user of a shared device completed onboarding. That says
    // nothing about whoever is holding the phone now.
    expect(launchRoute({ isLoading: false, isSignedIn: false, state: 'completed' })).toBe(
      '/onboarding/welcome',
    );
  });

  it('sends a finished user home', () => {
    for (const state of ['completed', 'skipped'] as const) {
      expect(launchRoute({ isLoading: false, isSignedIn: true, state })).toBe('/');
    }
  });

  it('treats skipping as finished, not as unfinished', () => {
    // "I'll do this later" is a tertiary action, never styled as failure — and
    // it must not put someone back at the start on the next launch.
    expect(launchRoute({ isLoading: false, isSignedIn: true, state: 'skipped' })).toBe('/');
  });

  it('resumes a half-finished user after the account step', () => {
    expect(launchRoute({ isLoading: false, isSignedIn: true, state: 'in_progress' })).toBe(
      '/onboarding/closet',
    );
  });

  it('guesses Home when signed in and the server has not said', () => {
    expect(launchRoute({ isLoading: false, isSignedIn: true, state: undefined })).toBe('/');
  });

  it('never sends a signed-in user to the account step', () => {
    // They would be asked to create an account they already have.
    for (const state of ['not_started', 'in_progress', 'completed', 'skipped'] as const) {
      expect(launchRoute({ isLoading: false, isSignedIn: true, state })).not.toContain('account');
    }
  });
});

describe('the sequence', () => {
  it('runs welcome → value → account → closet and stops', () => {
    expect(nextStep('welcome')).toBe('value');
    expect(nextStep('value')).toBe('account');
    expect(nextStep('account')).toBe('closet');
    expect(nextStep('closet')).toBeNull();
  });
});

describe('the copy the spec fixes', () => {
  it('has §3’s three cards, in order', () => {
    expect(VALUE_CARDS.map((c) => c.title)).toEqual([
      'Know what you own',
      'Style what you own',
      'See it on you',
    ]);
  });

  it('leads the closet routes with email', () => {
    // §5: the email option gets visual priority because it has the highest
    // item-per-action yield.
    expect(CLOSET_ROUTES[0].key).toBe('email');
  });

  it('marks every unbuilt route with the phase that brings it', () => {
    // A route with no destination must say it is coming rather than look
    // broken (CAP-4: every path degrades rather than dead-ends).
    for (const route of CLOSET_ROUTES) {
      if (route.to === null) expect(route.status).not.toBeNull();
    }
  });
});
