/**
 * Undo descriptors for reversible closet changes.
 *
 * `docs/02-design/states-and-errors.md` — Destructive actions:
 *
 *   - **Undo, not confirm**, wherever reversible: archive and status change.
 *   - **Confirm** only for genuine deletion, and the confirmation must state
 *     whether it can be recovered.
 *
 * React-free, so the copy and the reversal rules are testable without a
 * simulator. Getting these strings right matters: a snackbar that says the
 * wrong thing is worse than none, because the user acts on it.
 */
import type { GarmentStatus } from '@mira/taxonomy';

/** How long an undo stays available before the snackbar dismisses itself. */
export const UNDO_DURATION_MS = 6000;

const STATUS_PAST_TENSE: Partial<Record<GarmentStatus, string>> = {
  active: 'Back in your closet',
  laundry: 'Moved to the laundry',
  unavailable: 'Marked unavailable',
  lent_out: 'Marked as lent out',
  lost: 'Marked as lost',
  archived: 'Archived',
};

/**
 * The snackbar message for a status change.
 *
 * Second person, warm, brief — and it names what happened rather than what was
 * clicked (`docs/02-design/ux-principles.md` — Copy conventions).
 */
export function statusChangeMessage(next: GarmentStatus): string {
  return STATUS_PAST_TENSE[next] ?? 'Updated';
}

/**
 * Statuses that remove a garment from the closet grid.
 *
 * After one of these the user is looking at a piece that is no longer where
 * they found it, so the screen should step back rather than stay on a detail
 * view that the grid no longer lists.
 */
export function leavesTheCloset(status: GarmentStatus): boolean {
  return status === 'archived';
}

export type UndoAction = {
  message: string;
  actionLabel: string;
  /** The status to restore. */
  revertTo: GarmentStatus;
};

/**
 * Build the undo for a status change.
 *
 * The previous status is captured BEFORE the mutation, because after it the
 * old value is gone — that is the whole reason optimistic updates keep a
 * snapshot.
 */
export function undoForStatusChange(previous: GarmentStatus, next: GarmentStatus): UndoAction {
  return {
    message: statusChangeMessage(next),
    actionLabel: 'Undo',
    revertTo: previous,
  };
}

/**
 * Copy for the removal confirmation.
 *
 * "Deletion confirmations state exactly what is removed and whether it can be
 * recovered." Removal is a SOFT delete recoverable for 30 days
 * (`docs/07-security/data-retention.md`), and saying so is the difference
 * between a scary dialog and an honest one.
 */
export const REMOVAL_RECOVERY_DAYS = 30;

export function removalConfirmation(name: string | null): {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
} {
  const subject = name?.trim() ? `"${name.trim()}"` : 'this piece';
  return {
    title: `Remove ${subject}?`,
    body: `It leaves your closet, and Mira stops suggesting it. You can restore it for ${REMOVAL_RECOVERY_DAYS} days.`,
    confirmLabel: 'Remove',
    cancelLabel: 'Keep it',
  };
}

/** The snackbar shown after a confirmed removal, since removal is reversible. */
export function undoForRemoval(): { message: string; actionLabel: string } {
  return { message: 'Removed from your closet', actionLabel: 'Undo' };
}
