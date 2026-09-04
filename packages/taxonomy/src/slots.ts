/**
 * Outfit slot rules (taxonomy §14).
 *
 * > `dress` is mutually exclusive with `top` + `bottom` by default; the user may
 * > override (layering a top over a dress is legitimate). `accessory` may
 * > repeat.
 *
 * "By default" is the whole design. These are the rules the builder APPLIES,
 * not constraints the database imposes — a top over a dress is a real outfit,
 * and a product that refuses to save it is wrong about clothes. So every
 * conflict here is advisory: it says what to warn about, never what to forbid.
 */
import { type Category, type OutfitSlot } from './generated.js';

/**
 * Where a garment goes by default.
 *
 * `null` for categories with no natural slot — `other` most obviously. The
 * builder asks rather than guessing, because putting a garment in the wrong
 * slot silently is worse than one extra tap.
 */
export function defaultSlotFor(category: Category | string): OutfitSlot | null {
  switch (category) {
    case 'tops':
      return 'top';
    case 'bottoms':
      return 'bottom';
    case 'dresses':
      return 'dress';
    case 'outerwear':
      return 'layer';
    case 'shoes':
      return 'shoes';
    case 'bags':
      return 'bag';
    case 'accessories':
      return 'accessory';
    // `sets` is a top and a bottom sold together; it occupies the dress slot
    // because it is styled as one decision, not two.
    case 'sets':
      return 'dress';
    case 'activewear':
    case 'swimwear':
    case 'other':
    default:
      return null;
  }
}

/** Slots that may hold more than one garment. */
export const REPEATABLE_SLOTS: readonly OutfitSlot[] = ['accessory', 'layer'];

export const isRepeatable = (slot: OutfitSlot): boolean => REPEATABLE_SLOTS.includes(slot);

export type SlotConflict =
  /** A dress and a top/bottom in the same look. */
  | { kind: 'dress_with_separates'; slot: OutfitSlot; existing: OutfitSlot }
  /** A second garment in a slot that normally holds one. */
  | { kind: 'slot_occupied'; slot: OutfitSlot; existing: OutfitSlot };

/**
 * What is odd about adding `slot` to a look that already has `existing`.
 *
 * Returns advice, not a verdict. An empty array means "nothing to mention";
 * a conflict means "worth a word before saving", never "refused".
 */
export function conflictsFor(existing: OutfitSlot[], slot: OutfitSlot): SlotConflict[] {
  const conflicts: SlotConflict[] = [];

  if (slot === 'dress') {
    for (const other of existing) {
      if (other === 'top' || other === 'bottom') {
        conflicts.push({ kind: 'dress_with_separates', slot, existing: other });
      }
    }
  }

  if (slot === 'top' || slot === 'bottom') {
    if (existing.includes('dress')) {
      conflicts.push({ kind: 'dress_with_separates', slot, existing: 'dress' });
    }
  }

  if (!isRepeatable(slot) && existing.includes(slot)) {
    conflicts.push({ kind: 'slot_occupied', slot, existing: slot });
  }

  return conflicts;
}

/**
 * Is this a complete look?
 *
 * Deliberately generous. A dress and shoes is an outfit; so is a top, bottom
 * and shoes. Anything less is a start, not a mistake — the builder should say
 * what is missing without refusing to save.
 */
export function isWearable(slots: OutfitSlot[]): boolean {
  const has = (slot: OutfitSlot) => slots.includes(slot);
  const covered = has('dress') || (has('top') && has('bottom'));
  return covered;
}

/** What a half-built look is still missing, in the order to suggest it. */
export function missingSlots(slots: OutfitSlot[]): OutfitSlot[] {
  if (isWearable(slots)) return [];

  const has = (slot: OutfitSlot) => slots.includes(slot);
  if (has('dress')) return [];
  if (has('top')) return ['bottom'];
  if (has('bottom')) return ['top'];
  return ['top', 'bottom'];
}

/** Display order: how a look reads top to bottom. */
export const SLOT_ORDER: readonly OutfitSlot[] = [
  'layer',
  'dress',
  'top',
  'bottom',
  'shoes',
  'bag',
  'accessory',
];

export function compareSlots(a: OutfitSlot, b: OutfitSlot): number {
  return SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b);
}
