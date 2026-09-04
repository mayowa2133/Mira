import { describe, expect, it } from 'vitest';
import {
  EMPTY_FORM,
  formFromGarment,
  hasChanges,
  isValid,
  setCategory,
  subcategoriesFor,
  toCreatePayload,
  toUpdatePayload,
  toggleIn,
  validateForm,
  type GarmentFormState,
  type GarmentLike,
} from './garment-form';
import {
  EMPTY_FILTERS,
  appliedChips,
  colorOptions,
  countActive,
  ctaLabel,
  isEmpty,
  toQueryFilters,
  toggleValue,
} from './filter-state';

const filled = (overrides: Partial<GarmentFormState> = {}): GarmentFormState => ({
  ...EMPTY_FORM,
  category: 'dresses',
  subcategory: 'midi_dress',
  name: 'Satin Midi Dress',
  brand: 'Zara',
  primaryColor: 'black',
  sizeRaw: 'S',
  season: ['summer'],
  occasion: ['dinner'],
  purchasePrice: '79.90',
  currency: 'CAD',
  ...overrides,
});

describe('garment form — category and subcategory', () => {
  it('lists subcategories for a category', () => {
    expect(subcategoriesFor('dresses')).toContain('midi_dress');
    expect(subcategoriesFor('shoes')).toContain('heels');
  });

  it('lists nothing for an unknown or absent category', () => {
    expect(subcategoriesFor(null)).toEqual([]);
    expect(subcategoriesFor('outfits')).toEqual([]);
  });

  it('keeps a subcategory that still belongs to the new category', () => {
    const next = setCategory(filled(), 'dresses');
    expect(next.subcategory).toBe('midi_dress');
  });

  // Without this, the user would submit `shoes/midi_dress` and meet a
  // `subcategory_mismatch` from the server for something the UI let them do.
  it('clears a subcategory that does not belong to the new category', () => {
    const next = setCategory(filled(), 'shoes');
    expect(next.category).toBe('shoes');
    expect(next.subcategory).toBeNull();
  });

  it('clears the subcategory when the category is cleared', () => {
    expect(setCategory(filled(), null).subcategory).toBeNull();
  });
});

describe('garment form — validation', () => {
  it('requires only a category', () => {
    const errors = validateForm({ ...EMPTY_FORM, category: 'tops' });
    expect(isValid(errors)).toBe(true);
  });

  it('rejects a missing category with copy that says what to do', () => {
    const errors = validateForm(EMPTY_FORM);
    expect(errors.category).toBeTruthy();
    expect(errors.category).toMatch(/category/i);
  });

  it('rejects a category outside the taxonomy (INV-1)', () => {
    expect(validateForm({ ...EMPTY_FORM, category: 'outfits' }).category).toBeTruthy();
  });

  it.each(['abc', '-5'])('rejects an invalid price: %s', (price) => {
    expect(validateForm(filled({ purchasePrice: price })).purchasePrice).toBeTruthy();
  });

  it('accepts an empty price — price is optional', () => {
    expect(validateForm(filled({ purchasePrice: '' })).purchasePrice).toBeUndefined();
  });

  it('rejects a malformed date but accepts an empty one', () => {
    expect(validateForm(filled({ purchaseDate: '14/08/2026' })).purchaseDate).toBeTruthy();
    expect(validateForm(filled({ purchaseDate: '2026-08-14' })).purchaseDate).toBeUndefined();
    expect(validateForm(filled({ purchaseDate: '' })).purchaseDate).toBeUndefined();
  });
});

describe('garment form — create payload', () => {
  it('marks manual entry as manual provenance', () => {
    expect(toCreatePayload(filled()).source_type).toBe('manual');
  });

  it('sends empty strings as null, not as empty strings', () => {
    const payload = toCreatePayload(filled({ name: '   ', retailer: '' }));
    expect(payload.name).toBeNull();
    expect(payload.retailer).toBeNull();
  });

  it('sends a numeric price with its currency', () => {
    const payload = toCreatePayload(filled({ purchasePrice: '79.90', currency: 'CAD' }));
    expect(payload.purchase_price).toBe(79.9);
    expect(payload.currency).toBe('CAD');
  });

  // The API rejects a price without a currency, so they must travel together.
  it('sends a null currency when there is no price', () => {
    const payload = toCreatePayload(filled({ purchasePrice: '' }));
    expect(payload.purchase_price).toBeNull();
    expect(payload.currency).toBeNull();
  });

  it('sends tags_attached as null rather than false when unticked', () => {
    // null means "unknown", false would assert the tags are definitely off.
    expect(toCreatePayload(filled({ tagsAttached: false })).tags_attached).toBeNull();
    expect(toCreatePayload(filled({ tagsAttached: true })).tags_attached).toBe(true);
  });
});

describe('garment form — update payload', () => {
  const garment: GarmentLike = {
    category: 'dresses',
    subcategory: 'midi_dress',
    name: 'Satin Midi Dress',
    brand: { name: 'Zara' },
    brand_raw: 'Zara',
    primary_color: 'black',
    pattern: 'solid',
    materials: ['polyester'],
    size: { raw: 'S' },
    season: ['summer'],
    occasion: ['dinner'],
    style_tags: [],
    purchase: { retailer: 'Zara', date: '2026-08-14', price: { amount: 79.9, currency: 'CAD' } },
    tags_attached: null,
    notes: null,
  };

  it('round-trips a garment into form state', () => {
    const form = formFromGarment(garment);
    expect(form.category).toBe('dresses');
    expect(form.brand).toBe('Zara');
    expect(form.purchasePrice).toBe('79.9');
    expect(form.currency).toBe('CAD');
  });

  it('sends nothing when nothing changed', () => {
    const form = formFromGarment(garment);
    expect(toUpdatePayload(form, form)).toEqual({});
    expect(hasChanges(form, form)).toBe(false);
  });

  it('sends only the changed fields', () => {
    const form = formFromGarment(garment);
    const patch = toUpdatePayload(form, { ...form, name: 'Renamed' });
    expect(patch).toEqual({ name: 'Renamed' });
    expect(hasChanges(form, { ...form, name: 'Renamed' })).toBe(true);
  });

  // Provenance is immutable; the API rejects it with `immutable_field` (CAP-3).
  it('NEVER sends source_type', () => {
    const form = formFromGarment(garment);
    const patch = toUpdatePayload(form, { ...form, category: 'tops', subcategory: null });
    expect(patch).not.toHaveProperty('source_type');
    expect(Object.keys(toUpdatePayload(form, form))).not.toContain('source_type');
  });

  it('sends a cleared field as null', () => {
    const form = formFromGarment(garment);
    expect(toUpdatePayload(form, { ...form, notes: '', retailer: '' }).retailer).toBeNull();
  });
});

describe('toggleIn', () => {
  it('adds and removes', () => {
    expect(toggleIn([], 'summer')).toEqual(['summer']);
    expect(toggleIn(['summer'], 'summer')).toEqual([]);
    expect(toggleIn(['summer'], 'winter')).toEqual(['summer', 'winter']);
  });
});

describe('filter state', () => {
  it('starts empty', () => {
    expect(isEmpty(EMPTY_FILTERS)).toBe(true);
    expect(countActive(EMPTY_FILTERS)).toBe(0);
    expect(toQueryFilters(EMPTY_FILTERS)).toEqual({});
  });

  it('omits false booleans entirely', () => {
    // Sending favorite=false would filter to NON-favourites, which is not what
    // an un-ticked box means.
    const query = toQueryFilters({ ...EMPTY_FILTERS, favorite: false, neverWorn: false });
    expect(query).not.toHaveProperty('favorite');
    expect(query).not.toHaveProperty('never_worn');
  });

  it('maps toggles onto the right query params', () => {
    const query = toQueryFilters({
      ...EMPTY_FILTERS,
      neverWorn: true,
      tagsAttached: true,
      favorite: true,
    });
    expect(query).toMatchObject({ never_worn: true, tags_attached: true, favorite: true });
  });

  it('requests laundry explicitly, because the closet hides it by default', () => {
    expect(toQueryFilters({ ...EMPTY_FILTERS, laundry: true }).status).toEqual(['laundry']);
  });

  it('passes arrays through for OR-within-field semantics', () => {
    const query = toQueryFilters({ ...EMPTY_FILTERS, category: ['tops', 'dresses'] });
    expect(query.category).toEqual(['tops', 'dresses']);
  });

  it('counts every active filter', () => {
    expect(countActive({ ...EMPTY_FILTERS, category: ['tops', 'dresses'], favorite: true })).toBe(
      3,
    );
  });

  it('toggles values in a list', () => {
    expect(toggleValue(['tops'], 'tops')).toEqual([]);
    expect(toggleValue(['tops'], 'dresses')).toEqual(['tops', 'dresses']);
  });
});

describe('applied filter chips', () => {
  it('produces one removable chip per active filter', () => {
    const state = { ...EMPTY_FILTERS, category: ['dresses'], color: ['black'], neverWorn: true };
    const chips = appliedChips(state);
    expect(chips.map((c) => c.label)).toEqual(['Dresses', 'Black', 'Never worn']);
  });

  it('removes exactly the filter it names, leaving the rest', () => {
    const state = { ...EMPTY_FILTERS, category: ['dresses', 'tops'], favorite: true };
    const chips = appliedChips(state);
    const removeDresses = chips.find((c) => c.label === 'Dresses');
    const next = removeDresses!.remove(state);
    expect(next.category).toEqual(['tops']);
    expect(next.favorite).toBe(true);
  });

  it('gives every chip a stable unique key', () => {
    const chips = appliedChips({ ...EMPTY_FILTERS, category: ['tops'], color: ['tan'] });
    expect(new Set(chips.map((c) => c.key)).size).toBe(chips.length);
  });

  it('produces no chips when nothing is applied', () => {
    expect(appliedChips(EMPTY_FILTERS)).toEqual([]);
  });
});

describe('colour options (A11Y-4)', () => {
  it('gives every colour a readable name, not just a swatch', () => {
    for (const option of colorOptions()) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.label).not.toContain('_');
    }
  });

  it('gives multicolor no single swatch', () => {
    expect(colorOptions().find((o) => o.value === 'multicolor')?.swatch).toBeNull();
  });

  it('gives every other colour a hex swatch', () => {
    for (const option of colorOptions()) {
      if (option.value === 'multicolor') continue;
      expect(option.swatch).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe('filter CTA copy', () => {
  it.each([
    [undefined, 'Show items'],
    [0, 'No pieces match'],
    [1, 'Show 1 piece'],
    [38, 'Show 38 pieces'],
  ])('formats %s as "%s"', (count, expected) => {
    expect(ctaLabel(count as number | undefined)).toBe(expected);
  });
});

describe('the filters §16 adds (task 5.6)', () => {
  const withFilters = (over: Partial<typeof EMPTY_FILTERS>) => ({ ...EMPTY_FILTERS, ...over });

  it('sends brand ids, sizes and a price range', () => {
    const query = toQueryFilters(
      withFilters({ brandId: ['b1'], size: ['S'], priceMin: 20, priceMax: 80 }),
    );
    expect(query.brand_id).toEqual(['b1']);
    expect(query.size).toEqual(['S']);
    expect(query.price_min).toBe(20);
    expect(query.price_max).toBe(80);
  });

  it('sends one end of a range without inventing the other', () => {
    // "Under 50" is a real thing to ask; a floor of 0 is a different filter
    // that would exclude anything with no price recorded.
    const query = toQueryFilters(withFilters({ priceMax: 50 }));
    expect(query.price_max).toBe(50);
    expect(query.price_min).toBeUndefined();
  });

  it('asks the server what "recently added" means', () => {
    // A window, not a date the client computed: a clock a day out would
    // silently include or exclude a piece on the boundary.
    expect(toQueryFilters(withFilters({ recentlyAdded: true })).added_within_days).toBe(30);
  });

  it('counts a price range as one filter, not two', () => {
    expect(countActive(withFilters({ priceMin: 20, priceMax: 80 }))).toBe(1);
  });

  it('counts the new filters as active', () => {
    expect(isEmpty(withFilters({ brandId: ['b1'] }))).toBe(false);
    expect(isEmpty(withFilters({ size: ['S'] }))).toBe(false);
    expect(isEmpty(withFilters({ recentlyAdded: true }))).toBe(false);
    expect(isEmpty(withFilters({ priceMax: 50 }))).toBe(false);
  });

  it('names a brand chip rather than showing its id', () => {
    const chips = appliedChips(withFilters({ brandId: ['b1'] }), new Map([['b1', 'Aritzia']]));
    expect(chips.map((c) => c.label)).toContain('Aritzia');
  });

  it('skips a brand chip whose name has not loaded', () => {
    // A uuid on a chip is worse than no chip at all.
    expect(appliedChips(withFilters({ brandId: ['b1' ] }))).toHaveLength(0);
  });

  it('says a price range the way a person would', () => {
    const label = (min: number | null, max: number | null) =>
      appliedChips(withFilters({ priceMin: min, priceMax: max }))[0]?.label;

    expect(label(20, 80)).toBe('20–80');
    expect(label(null, 50)).toBe('Under 50');
    expect(label(50, null)).toBe('Over 50');
  });

  it('removes each new filter in one tap', () => {
    const start = withFilters({ brandId: ['b1'], size: ['S'], priceMax: 50, recentlyAdded: true });
    const names = new Map([['b1', 'Aritzia']]);

    let state = start;
    for (const chip of appliedChips(start, names)) state = chip.remove(state);

    expect(isEmpty(state)).toBe(true);
  });
});
