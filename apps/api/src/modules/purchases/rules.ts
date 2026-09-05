/**
 * Purchase candidate rules (`docs/04-data/taxonomy.md` §12, ADR 0003, OWN-1).
 *
 * The single invariant everything here protects:
 *
 * > **A detected purchase is never a garment.** Only a transition to
 * > `confirmed_owned` creates one.
 *
 * D-003 explains why: purchases get returned, sold, gifted, and are sometimes
 * not clothing at all. A wrong garment in the closet breaks the one thing Mira
 * must get right, because the stylist will then recommend clothes she does not
 * have.
 *
 * React-free and database-free, so the transition table is readable as a table.
 */
import type { PurchaseCandidateStatus } from '@mira/taxonomy';

/** The one status that creates a garment (taxonomy §12). */
export const CREATES_GARMENT: PurchaseCandidateStatus = 'confirmed_owned';

/**
 * Statuses Mira sets for itself while working.
 *
 * A user cannot move a candidate to these: "processing" is a claim about
 * Mira's own progress, and letting a client assert it would let a stalled
 * scan look busy forever.
 */
const MACHINE_ONLY: PurchaseCandidateStatus[] = ['detected', 'processing'];

/**
 * What the user may choose, from the review card.
 *
 * `needs_review` and `uncertain` are both reachable: "not sure" is a real
 * answer that must not force a decision, and it keeps the candidate in the
 * reviewable set rather than burying it (§12).
 */
export const USER_SETTABLE: PurchaseCandidateStatus[] = [
  'confirmed_owned',
  'returned',
  'not_mine',
  'removed',
  'uncertain',
  'ignored',
];

/** Terminal in practice: dismissed, and not shown again unless asked for. */
export const DISMISSED: PurchaseCandidateStatus[] = ['removed', 'not_mine', 'ignored'];

/** What the discovery screen shows by default. */
export const REVIEWABLE: PurchaseCandidateStatus[] = ['detected', 'needs_review', 'uncertain'];

export type TransitionVerdict =
  { allowed: true; createsGarment: boolean } | { allowed: false; reason: string };

/**
 * May the user move this candidate to `to`?
 *
 * Re-confirming something already confirmed is refused rather than ignored: it
 * would otherwise be a silent second garment for one purchase, and the caller
 * needs to know the difference between "done" and "done again".
 */
export function canTransition(
  from: PurchaseCandidateStatus,
  to: PurchaseCandidateStatus,
): TransitionVerdict {
  if (MACHINE_ONLY.includes(to)) {
    return { allowed: false, reason: `"${to}" is set by Mira, not chosen` };
  }
  if (!USER_SETTABLE.includes(to)) {
    return { allowed: false, reason: `"${to}" is not a status a user can set` };
  }
  if (from === to) {
    return { allowed: false, reason: `already "${to}"` };
  }
  if (from === CREATES_GARMENT) {
    // The garment exists and is the user's now. Changing their mind about the
    // PURCHASE is done on the garment (archive, sold, returned), not by
    // rewriting the candidate — otherwise the closet and the record disagree.
    return {
      allowed: false,
      reason: 'this is already in your closet; change it there',
    };
  }

  return { allowed: true, createsGarment: to === CREATES_GARMENT };
}

/**
 * Should this candidate be imported without asking?
 *
 * `feature-specs.md` F-05: only candidates above the confidence threshold
 * auto-create garments, and only when the user has opted in. Every other
 * condition here exists because auto-import is the one path that puts something
 * in the closet with nobody looking.
 */
export type AutoImportInput = {
  /** The user's opt-in. Off by default, and the whole feature hangs on it. */
  enabled: boolean;
  status: PurchaseCandidateStatus;
  matchConfidence: number | null;
  /** A candidate Mira could not name is not one it should import silently. */
  productName: string | null;
  /** Set when duplicate detection found something (CAP-5). */
  possibleDuplicateOf: string | null;
};

/**
 * The bar for importing without asking.
 *
 * Deliberately higher than the review threshold. A wrong garment that someone
 * chose is a mistake; a wrong garment that appeared on its own is a breach of
 * trust in the closet, which `product-vision.md` treats as the thing Mira must
 * get right.
 */
export const AUTO_IMPORT_CONFIDENCE = 0.95;

export function shouldAutoImport(input: AutoImportInput): boolean {
  if (!input.enabled) return false;
  // Only from the states that are actually awaiting a decision.
  if (!REVIEWABLE.includes(input.status)) return false;
  if (input.matchConfidence === null) return false;
  if (input.matchConfidence < AUTO_IMPORT_CONFIDENCE) return false;
  if (!input.productName) return false;
  // A possible duplicate is exactly the case a human should look at: importing
  // it silently is how someone ends up owning the same coat twice on paper.
  if (input.possibleDuplicateOf) return false;
  return true;
}

/** How long an auto-import can be undone (F-05: "at least 30 days"). */
export const AUTO_IMPORT_UNDO_DAYS = 30;

export function undoDeadline(importedAt: Date): Date {
  return new Date(importedAt.getTime() + AUTO_IMPORT_UNDO_DAYS * 86_400_000);
}

export function canUndoAutoImport(importedAt: Date, now: Date = new Date()): boolean {
  return now <= undoDeadline(importedAt);
}
