import { describe, expect, it } from 'vitest';
import {
  AUTO_IMPORT_CONFIDENCE,
  AUTO_IMPORT_UNDO_DAYS,
  CREATES_GARMENT,
  canTransition,
  canUndoAutoImport,
  shouldAutoImport,
} from './rules.js';

describe('what creates a garment (OWN-1)', () => {
  it('is exactly one status, and it is confirmed_owned', () => {
    // taxonomy §12: one row in that table says "Yes".
    expect(CREATES_GARMENT).toBe('confirmed_owned');

    const creating = (
      ['confirmed_owned', 'returned', 'not_mine', 'removed', 'uncertain', 'ignored'] as const
    ).filter((to) => {
      const verdict = canTransition('needs_review', to);
      return verdict.allowed && verdict.createsGarment;
    });

    expect(creating).toEqual(['confirmed_owned']);
  });

  it('refuses statuses Mira sets for itself', () => {
    // "processing" is a claim about Mira's progress; a client asserting it
    // would let a stalled scan look busy forever.
    for (const to of ['detected', 'processing'] as const) {
      expect(canTransition('needs_review', to).allowed).toBe(false);
    }
  });

  it('refuses re-confirming, rather than ignoring it', () => {
    // Silently ignoring would be a second garment for one purchase.
    const verdict = canTransition('confirmed_owned', 'confirmed_owned');
    expect(verdict.allowed).toBe(false);
  });

  it('will not rewrite a candidate that is already in the closet', () => {
    // The garment is the user's now; changing their mind happens there, or the
    // closet and the purchase record disagree.
    const verdict = canTransition('confirmed_owned', 'returned');
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.reason).toContain('already in your closet');
  });

  it('lets someone say "not sure" without forcing a decision', () => {
    expect(canTransition('detected', 'uncertain').allowed).toBe(true);
  });
});

describe('auto-import (F-05)', () => {
  const base = {
    enabled: true,
    status: 'needs_review' as const,
    matchConfidence: 0.99,
    productName: 'Contour Bodysuit',
    possibleDuplicateOf: null,
  };

  it('imports a high-confidence, named, unambiguous candidate', () => {
    expect(shouldAutoImport(base)).toBe(true);
  });

  it('does nothing at all unless the user opted in', () => {
    // The whole feature hangs on this, and it is off by default.
    expect(shouldAutoImport({ ...base, enabled: false })).toBe(false);
  });

  it('holds a higher bar than review', () => {
    expect(shouldAutoImport({ ...base, matchConfidence: AUTO_IMPORT_CONFIDENCE })).toBe(true);
    expect(shouldAutoImport({ ...base, matchConfidence: AUTO_IMPORT_CONFIDENCE - 0.01 })).toBe(
      false,
    );
  });

  it('refuses when there is no confidence at all', () => {
    // No match means nothing to be confident about.
    expect(shouldAutoImport({ ...base, matchConfidence: null })).toBe(false);
  });

  it('refuses a candidate it cannot name', () => {
    // A garment appearing in the closet with no name is indistinguishable
    // from a bug.
    expect(shouldAutoImport({ ...base, productName: null })).toBe(false);
  });

  it('refuses a possible duplicate, which is exactly what a human should see', () => {
    expect(shouldAutoImport({ ...base, possibleDuplicateOf: 'garment-1' })).toBe(false);
  });

  it('only fires on candidates actually awaiting a decision', () => {
    for (const status of ['confirmed_owned', 'removed', 'returned'] as const) {
      expect(shouldAutoImport({ ...base, status })).toBe(false);
    }
  });
});

describe('undoing an auto-import', () => {
  it('stays undoable for at least the 30 days F-05 promises', () => {
    expect(AUTO_IMPORT_UNDO_DAYS).toBeGreaterThanOrEqual(30);

    const imported = new Date('2026-01-01T12:00:00Z');
    const day29 = new Date('2026-01-30T12:00:00Z');
    expect(canUndoAutoImport(imported, day29)).toBe(true);
  });

  it('closes after the window', () => {
    const imported = new Date('2026-01-01T12:00:00Z');
    const day31 = new Date('2026-02-01T12:00:01Z');
    expect(canUndoAutoImport(imported, day31)).toBe(false);
  });
});
