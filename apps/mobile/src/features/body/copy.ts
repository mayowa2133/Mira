/**
 * Body profile copy (§23, TRY-2).
 *
 * TRY-2: **copy must never imply guaranteed fit.** Try-on shows how a piece
 * looks; it cannot promise how it fits, and every line here is written so that
 * a hopeful reader cannot come away thinking otherwise.
 *
 * Kept apart from the screen so the promise is testable — a sentence is easy to
 * loosen by accident during a redesign.
 */
export const BODY_PROFILE_COPY = {
  title: 'Meet your Mira',
  intro: 'Add a few photos so Mira can show your wardrobe on you.',
  privacy: 'Your photos are private. Only you can see them, and you can delete them at any time.',
  // The TRY-2 sentence, verbatim from §23.
  limitation: "Try-on shows how a piece looks — it can't promise how it fits.",
  guidance: 'Full body in frame, plain background, fitted clothing, good light.',
  save: 'Save body profile',
} as const;

/** Words that would turn a demonstration into a promise. */
export const FORBIDDEN_FIT_CLAIMS = [
  'will fit',
  'fits you',
  'guaranteed',
  'true to size',
  'your exact',
  'perfect fit',
];

/** §23's three photo slots. Only the first is required. */
export const PHOTO_SLOTS = [
  { kind: 'front', label: 'Front photo', required: true },
  { kind: 'side', label: 'Side photo', required: false },
  { kind: 'reference', label: 'Another reference', required: false },
] as const;
