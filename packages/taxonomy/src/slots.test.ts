import { describe, expect, it } from 'vitest';
import {
  compareSlots,
  conflictsFor,
  defaultSlotFor,
  isRepeatable,
  isWearable,
  missingSlots,
} from './slots.js';

describe('defaultSlotFor', () => {
  it('maps the obvious categories', () => {
    expect(defaultSlotFor('tops')).toBe('top');
    expect(defaultSlotFor('dresses')).toBe('dress');
    expect(defaultSlotFor('outerwear')).toBe('layer');
    expect(defaultSlotFor('shoes')).toBe('shoes');
  });

  it('treats a set as one styling decision', () => {
    // A co-ord is bought and worn as one thing, not as a top plus a bottom.
    expect(defaultSlotFor('sets')).toBe('dress');
  });

  it('asks rather than guessing for categories with no natural slot', () => {
    // Putting a garment in the wrong slot silently is worse than one more tap.
    expect(defaultSlotFor('other')).toBeNull();
    expect(defaultSlotFor('activewear')).toBeNull();
  });
});

describe('conflictsFor', () => {
  it('flags a dress added to separates', () => {
    const conflicts = conflictsFor(['top', 'bottom'], 'dress');
    expect(conflicts).toHaveLength(2);
    expect(conflicts[0]?.kind).toBe('dress_with_separates');
  });

  it('flags a top added over a dress', () => {
    expect(conflictsFor(['dress'], 'top')[0]?.kind).toBe('dress_with_separates');
  });

  it('is advisory, not a refusal', () => {
    // taxonomy §14: the user may override — layering a top over a dress is
    // legitimate, and a product that refuses to save it is wrong about clothes.
    // The function reports; it never throws or returns a boolean verdict.
    expect(Array.isArray(conflictsFor(['dress'], 'top'))).toBe(true);
  });

  it('flags a second garment in a single-occupancy slot', () => {
    expect(conflictsFor(['shoes'], 'shoes')[0]?.kind).toBe('slot_occupied');
  });

  it('lets accessories and layers repeat', () => {
    expect(conflictsFor(['accessory'], 'accessory')).toEqual([]);
    expect(conflictsFor(['layer'], 'layer')).toEqual([]);
    expect(isRepeatable('accessory')).toBe(true);
  });

  it('has nothing to say about an ordinary addition', () => {
    expect(conflictsFor(['top', 'bottom'], 'shoes')).toEqual([]);
  });
});

describe('isWearable', () => {
  it('accepts a dress on its own', () => {
    expect(isWearable(['dress'])).toBe(true);
  });

  it('accepts a top and a bottom', () => {
    expect(isWearable(['top', 'bottom'])).toBe(true);
  });

  it('does not accept a top alone', () => {
    expect(isWearable(['top', 'shoes'])).toBe(false);
  });

  it('does not require shoes — a look is not an inventory checklist', () => {
    expect(isWearable(['dress'])).toBe(true);
  });
});

describe('missingSlots', () => {
  it('asks for the other half', () => {
    expect(missingSlots(['top'])).toEqual(['bottom']);
    expect(missingSlots(['bottom'])).toEqual(['top']);
  });

  it('asks for both when nothing covers the body', () => {
    expect(missingSlots(['shoes'])).toEqual(['top', 'bottom']);
  });

  it('asks for nothing once the look works', () => {
    expect(missingSlots(['dress'])).toEqual([]);
    expect(missingSlots(['top', 'bottom'])).toEqual([]);
  });
});

describe('compareSlots', () => {
  it('reads a look top to bottom', () => {
    const sorted = ['shoes', 'top', 'layer', 'bottom'].sort((a, b) =>
      compareSlots(a as never, b as never),
    );
    expect(sorted).toEqual(['layer', 'top', 'bottom', 'shoes']);
  });
});
