import { describe, expect, it } from 'vitest';
import { GARMENT_STATUSES, OUTFIT_ELIGIBLE_STATUSES } from '@mira/taxonomy';
import {
  REMOVAL_RECOVERY_DAYS,
  UNDO_DURATION_MS,
  leavesTheCloset,
  removalConfirmation,
  statusChangeMessage,
  undoForRemoval,
  undoForStatusChange,
} from './undo';

describe('status change copy', () => {
  it('names what happened, not what was tapped', () => {
    expect(statusChangeMessage('laundry')).toBe('Moved to the laundry');
    expect(statusChangeMessage('archived')).toBe('Archived');
    expect(statusChangeMessage('active')).toBe('Back in your closet');
  });

  it('has copy for every status a user can set', () => {
    for (const status of ['active', 'laundry', 'unavailable', 'lent_out', 'lost', 'archived']) {
      expect(statusChangeMessage(status as never)).not.toBe('Updated');
    }
  });

  it('falls back rather than throwing for a status set by another flow', () => {
    // `sold`, `returned` and `donated` are set by the flows that own them, so
    // they should never reach this copy — but a fallback beats a crash.
    expect(statusChangeMessage('sold' as never)).toBe('Updated');
  });

  it('never produces an empty message for any taxonomy status', () => {
    for (const status of GARMENT_STATUSES) {
      expect(statusChangeMessage(status).length).toBeGreaterThan(0);
    }
  });
});

describe('undo for a status change', () => {
  it('reverts to the status captured before the change', () => {
    const undo = undoForStatusChange('active', 'laundry');
    expect(undo.revertTo).toBe('active');
    expect(undo.actionLabel).toBe('Undo');
    expect(undo.message).toBe('Moved to the laundry');
  });

  it('round-trips: undoing an undo returns to where it started', () => {
    const first = undoForStatusChange('active', 'archived');
    const second = undoForStatusChange('archived', first.revertTo);
    expect(second.revertTo).toBe('archived');
  });

  it('gives the user long enough to react', () => {
    // Short enough not to nag, long enough to notice and reach the button.
    expect(UNDO_DURATION_MS).toBeGreaterThanOrEqual(5000);
    expect(UNDO_DURATION_MS).toBeLessThanOrEqual(10_000);
  });
});

describe('leaving the closet', () => {
  it('is true for archived, which the grid hides by default', () => {
    expect(leavesTheCloset('archived')).toBe(true);
  });

  it('is false for statuses the closet still shows', () => {
    // Laundry stays visible: it is unavailable for outfits, not gone.
    expect(leavesTheCloset('laundry')).toBe(false);
    expect(leavesTheCloset('active')).toBe(false);
    expect(leavesTheCloset('lent_out')).toBe(false);
  });

  it('never hides an outfit-eligible garment', () => {
    for (const status of OUTFIT_ELIGIBLE_STATUSES) {
      expect(leavesTheCloset(status)).toBe(false);
    }
  });
});

describe('removal confirmation', () => {
  // "Deletion confirmations state exactly what is removed and whether it can be
  // recovered" (docs/02-design/states-and-errors.md).
  it('names the piece being removed', () => {
    expect(removalConfirmation('Satin Midi Dress').title).toContain('Satin Midi Dress');
  });

  it('falls back gracefully for an unnamed piece', () => {
    expect(removalConfirmation(null).title).toBe('Remove this piece?');
    expect(removalConfirmation('   ').title).toBe('Remove this piece?');
  });

  it('states that removal is recoverable, and for how long', () => {
    const copy = removalConfirmation('Black Dress');
    expect(copy.body).toContain('restore');
    expect(copy.body).toContain(String(REMOVAL_RECOVERY_DAYS));
  });

  it('matches the retention policy window', () => {
    // docs/07-security/data-retention.md: soft-deleted garments purge after 30 days.
    expect(REMOVAL_RECOVERY_DAYS).toBe(30);
  });

  it('gives the cancel option a reassuring label, not just "Cancel"', () => {
    expect(removalConfirmation('x').cancelLabel).toBe('Keep it');
  });
});

describe('undo for removal', () => {
  it('offers an undo, because removal is a soft delete', () => {
    const undo = undoForRemoval();
    expect(undo.actionLabel).toBe('Undo');
    expect(undo.message).toBe('Removed from your closet');
  });
});
