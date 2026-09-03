import { describe, expect, it } from 'vitest';
import {
  CATEGORY_SUBCATEGORIES,
  CATEGORIES,
  COLOR_SWATCHES,
  CONFIDENCE,
  GARMENT_CREATING_CANDIDATE_STATUSES,
  GARMENT_STATUSES,
  OUTFIT_ELIGIBLE_STATUSES,
  PURCHASE_CANDIDATE_STATUSES,
  SOURCE_TYPES,
  clampArray,
  clampCategoryPair,
  clampValue,
  confidenceBand,
  createsGarment,
  isCategory,
  isColor,
  isOutfitEligible,
  isSubcategoryOf,
  normalizeConfidence,
} from './index.js';

describe('taxonomy shape', () => {
  it('has the canonical top-level categories', () => {
    expect([...CATEGORIES]).toEqual([
      'tops',
      'bottoms',
      'dresses',
      'sets',
      'outerwear',
      'shoes',
      'bags',
      'accessories',
      'activewear',
      'swimwear',
      'other',
    ]);
  });

  it('gives every category at least one subcategory', () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_SUBCATEGORIES[category].length).toBeGreaterThan(0);
    }
  });

  it('gives every colour a swatch, except multicolor', () => {
    for (const [color, swatch] of Object.entries(COLOR_SWATCHES)) {
      if (color === 'multicolor') expect(swatch).toBeNull();
      else expect(swatch).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('uses snake_case everywhere', () => {
    const all = [
      ...CATEGORIES,
      ...GARMENT_STATUSES,
      ...SOURCE_TYPES,
      ...PURCHASE_CANDIDATE_STATUSES,
    ];
    for (const value of all) expect(value).toMatch(/^[a-z0-9_]+$/);
  });
});

describe('outfit eligibility (INV-2, D-012)', () => {
  it('makes only active garments eligible', () => {
    expect([...OUTFIT_ELIGIBLE_STATUSES]).toEqual(['active']);
  });

  it.each([
    'laundry',
    'lent_out',
    'unavailable',
    'lost',
    'returned',
    'sold',
    'donated',
    'archived',
  ])('excludes %s from generated outfits', (status) => {
    expect(isOutfitEligible(status as never)).toBe(false);
  });

  it('includes active', () => {
    expect(isOutfitEligible('active')).toBe(true);
  });
});

describe('purchase candidates (OWN-1, ADR 0003)', () => {
  it('lets exactly one status create a garment', () => {
    expect([...GARMENT_CREATING_CANDIDATE_STATUSES]).toEqual(['confirmed_owned']);
  });

  it.each([
    'detected',
    'processing',
    'needs_review',
    'returned',
    'not_mine',
    'removed',
    'uncertain',
    'ignored',
  ])('never creates a garment from %s', (status) => {
    expect(createsGarment(status as never)).toBe(false);
  });

  it('creates a garment from confirmed_owned', () => {
    expect(createsGarment('confirmed_owned')).toBe(true);
  });
});

describe('clamping (AI-3, R3)', () => {
  it('drops an unknown value rather than mapping it to a neighbour', () => {
    const result = clampValue('category', 'jumpsuits', isCategory);
    expect(result.value).toBeNull();
    expect(result.drops).toEqual([
      { field: 'category', value: 'jumpsuits', reason: 'not_in_taxonomy' },
    ]);
  });

  it('keeps a known value', () => {
    expect(clampValue('category', 'dresses', isCategory).value).toBe('dresses');
  });

  it('treats null as absent, not as a drop', () => {
    expect(clampValue('category', null, isCategory)).toEqual({ value: null, drops: [] });
  });

  it('drops only the invalid members of an array', () => {
    const result = clampArray('colors', ['black', 'chartreuse', 'ivory'], isColor);
    expect(result.value).toEqual(['black', 'ivory']);
    expect(result.drops).toHaveLength(1);
  });

  it('rejects a subcategory that belongs to another category', () => {
    const result = clampCategoryPair('dresses', 'heels');
    expect(result.value).toEqual({ category: 'dresses', subcategory: null });
    expect(result.drops[0]?.reason).toBe('subcategory_mismatch');
  });

  it('accepts a subcategory that belongs to its category', () => {
    expect(clampCategoryPair('dresses', 'midi_dress').value).toEqual({
      category: 'dresses',
      subcategory: 'midi_dress',
    });
  });

  it('drops the subcategory when the category itself is unknown', () => {
    const result = clampCategoryPair('outfits', 'midi_dress');
    expect(result.value).toEqual({ category: null, subcategory: null });
    expect(result.drops).toHaveLength(2);
  });

  it('validates subcategory membership directly', () => {
    expect(isSubcategoryOf('shoes', 'heels')).toBe(true);
    expect(isSubcategoryOf('dresses', 'heels')).toBe(false);
  });
});

describe('confidence (D-011)', () => {
  it('uses the documented thresholds', () => {
    expect(CONFIDENCE).toEqual({ high: 0.85, medium: 0.6, low: 0.35, autoAccept: 0.92 });
  });

  it.each([
    [0.99, 'high'],
    [0.85, 'high'],
    [0.84, 'medium'],
    [0.6, 'medium'],
    [0.59, 'low'],
    [0.35, 'low'],
    [0.34, 'very_low'],
    [0, 'very_low'],
  ])('puts %s in the %s band', (value, band) => {
    expect(confidenceBand(value as number)).toBe(band);
  });

  it('clamps confidence into [0,1] and rejects non-numbers', () => {
    expect(normalizeConfidence(1.4)).toBe(1);
    expect(normalizeConfidence(-0.2)).toBe(0);
    expect(normalizeConfidence(0.7)).toBe(0.7);
    expect(normalizeConfidence('0.7')).toBeNull();
    expect(normalizeConfidence(Number.NaN)).toBeNull();
  });
});
