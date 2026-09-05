/**
 * Where a user is in onboarding, and where that sends them
 * (`docs/02-design/screen-specs.md` §1–5, `navigation.md` rule 7).
 *
 * React-free, because the routing decision is the part worth testing: it is
 * made once at launch from a value the server owns, and getting it wrong either
 * traps someone in onboarding forever or drops a brand-new account onto an
 * empty closet with no explanation.
 */

/** The `users.onboarding_state` values the schema allows. */
export type OnboardingState = 'not_started' | 'in_progress' | 'completed' | 'skipped';

export const ONBOARDING_STEPS = ['welcome', 'value', 'account', 'closet'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/**
 * Where launch should land.
 *
 * `null` means "stay where you are" — the app is still deciding, and §1 gives
 * the splash a maximum of 900 ms before it routes somewhere. Returning a route
 * while the answer is unknown is how a signed-in user gets a flash of Welcome.
 */
export function launchRoute(input: {
  isLoading: boolean;
  isSignedIn: boolean;
  state: OnboardingState | undefined;
  /**
   * False when the server could not be reached at all — offline, DNS, 5xx.
   * A 401 is NOT this: that is the server answering.
   */
  reachable?: boolean;
}): string | null {
  if (input.isLoading) return null;

  // An unreachable server is not a signed-out user.
  //
  // Signed-in is decided by asking the server who you are, so a dropped
  // connection produces exactly the same "no user" as a real sign-out — and
  // the app would send a returning user to the NEW-USER welcome flow because
  // their train went into a tunnel. Mira is meant to work offline; the
  // airplane-mode capture criterion says so outright.
  //
  // The same reading the `default` branch below already applies: when the
  // server has not told us, Home is the safer guess. Showing a returning user
  // Welcome is worse than showing a new one a closet they can add to.
  if (input.reachable === false) return null;

  // Not signed in: Welcome, whatever any stale cached state says.
  if (!input.isSignedIn) return '/onboarding/welcome';

  switch (input.state) {
    case 'completed':
    case 'skipped':
      return '/';
    case 'in_progress':
      // Resume at the step after the account, which is the only one a
      // signed-in user can already have completed.
      return '/onboarding/closet';
    case 'not_started':
      return '/onboarding/welcome';
    default:
      // Signed in but the server has not said. Home is the safer guess: showing
      // a returning user the welcome screen is worse than showing a new one a
      // closet they can add to.
      return '/';
  }
}

/** The next screen in the sequence, or null at the end. */
export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS[index + 1] ?? null;
}

/**
 * §3's three value cards.
 *
 * The copy is fixed by the spec, so it lives beside the routing rather than
 * inside a component where it would be retyped.
 */
export const VALUE_CARDS = [
  { title: 'Know what you own', body: 'Mira finds the clothes you already have.' },
  { title: 'Style what you own', body: "Outfits from your closet, for wherever you're going." },
  { title: 'See it on you', body: 'Try a look on before you put it on.' },
] as const;

/**
 * §5's four routes into a closet, in the spec's order.
 *
 * Email is first, and the screen gives it visual priority, because it has the
 * highest item-per-action yield. A route with no destination yet says it is
 * coming, so the screen shows it as pending rather than as broken (CAP-4).
 *
 * `icon` names a glyph in `src/ui/Icon.tsx`. These were emoji — on the first
 * screen a new user sees, which is the worst possible place to look like a
 * placeholder, and which rendered in whatever face the OS chose rather than in
 * Mira's.
 */
/** The only thing Mira says about a route it has not built. */
const COMING = 'Coming soon';

export const CLOSET_ROUTES = [
  {
    key: 'email',
    icon: 'mail' as const,
    title: 'Find online purchases',
    body: 'Connect email and find clothes you already bought',
    to: null as string | null,
    status: COMING as string | null,
  },
  {
    key: 'receipts',
    icon: 'receipt' as const,
    title: 'Scan receipts',
    body: null,
    to: null as string | null,
    status: COMING as string | null,
  },
  {
    key: 'clothes',
    icon: 'camera' as const,
    title: 'Scan clothes',
    body: null,
    to: '/add/scan' as string | null,
    status: null as string | null,
  },
  {
    key: 'tags',
    icon: 'tag' as const,
    title: 'Scan tags',
    body: null,
    to: null as string | null,
    status: COMING as string | null,
  },
] as const;
