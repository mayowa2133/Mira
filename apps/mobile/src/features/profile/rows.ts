/**
 * The You screen's rows (`docs/02-design/screen-specs.md` §28).
 *
 * React-free because the interesting part is which rows are reachable. Most of
 * §28 points at surfaces later phases build, and a row that opens nothing is
 * worse than a row that says when it arrives — CAP-4 asks every path to degrade
 * rather than dead-end, and that applies to a settings list as much as to an
 * import.
 */
export type ProfileRow = {
  key: string;
  label: string;
  /** Where it goes, or null while the surface does not exist. */
  to: string | null;
  /**
   * Shown when `to` is null, so the row reads as coming rather than broken.
   *
   * User-facing words only. This field said "Phase 8" and "Q-08" on a screen
   * real people look at — internal roadmap vocabulary that tells someone
   * nothing except that they are reading a document meant for someone else.
   */
  status: string | null;
};

/**
 * The only thing Mira says about a surface it has not built.
 *
 * Not a date and not a version: both are promises, and one of them will be
 * wrong. "Coming soon" is what a person can act on — wait, or stop looking.
 */
const COMING = 'Coming soon';

export const PROFILE_ROWS: readonly ProfileRow[] = [
  { key: 'style', label: 'Style preferences', to: '/profile/style', status: null },
  { key: 'body', label: 'Body profile', to: '/body', status: null },
  { key: 'accounts', label: 'Connected accounts', to: null, status: COMING },
  // The one row that must work now: privacy.md routes deletion and export
  // through it, and deletion is built.
  { key: 'privacy', label: 'Privacy & data', to: '/profile/privacy', status: null },
  { key: 'notifications', label: 'Notifications', to: null, status: COMING },
  { key: 'appearance', label: 'Appearance', to: null, status: COMING },
  { key: 'help', label: 'Help', to: null, status: null },
  { key: 'about', label: 'About Mira', to: null, status: null },
];

/**
 * What `Privacy & data` must offer, per `privacy.md` §Your rights.
 *
 * The list lives here rather than in the screen so the gap between what the
 * privacy policy promises and what the app can actually do is visible in one
 * place — and so a promise that is not yet keepable is labelled, not omitted.
 */
export type PrivacyAction = {
  key: string;
  label: string;
  /** What it does, said before it is tapped. */
  detail: string;
  available: boolean;
  /** Why not, when it is not. */
  blockedBy?: string;
};

export const PRIVACY_ACTIONS: readonly PrivacyAction[] = [
  {
    key: 'export',
    label: 'Export my data',
    detail: 'A copy of your garments, outfits, wear history and images.',
    available: false,
    blockedBy: COMING,
  },
  {
    key: 'body-images',
    label: 'Delete body photos',
    detail: 'Removed immediately, along with every try-on made from them.',
    available: false,
    blockedBy: COMING,
  },
  {
    key: 'try-ons',
    label: 'Delete try-ons',
    detail: 'Removed immediately.',
    available: false,
    blockedBy: COMING,
  },
  {
    key: 'account',
    label: 'Delete my account',
    detail: 'Everything, permanently. This cannot be undone.',
    available: true,
  },
];

/**
 * The confirmation for account deletion.
 *
 * `auth-contract.md` requires a confirmation "stating exactly what is removed".
 * "Exactly" is doing work in that sentence: a vague "all your data" leaves
 * someone guessing whether their outfits survive, and this is the one action in
 * the app with no undo.
 */
export const DELETE_ACCOUNT_CONFIRMATION = {
  title: 'Delete your account?',
  body:
    'Your closet, outfits, wear history, photographs and preferences are ' +
    'permanently removed. This cannot be undone, and Mira cannot restore any ' +
    'of it afterwards.',
  confirm: 'Delete everything',
  cancel: 'Keep my account',
} as const;
