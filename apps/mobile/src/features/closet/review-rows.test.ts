import { describe, expect, it } from 'vitest';
import { buildChips, buildReviewRows, displayValue, toReviewRow } from './review-rows';
import type { GarmentAttribute } from './queries';

const attribute = (over: Partial<GarmentAttribute> = {}): GarmentAttribute => ({
  field: 'brand',
  value: 'Ganni',
  band: 'high',
  source: 'ai',
  superseded: null,
  ...over,
});

describe('toReviewRow', () => {
  describe('what each band is allowed to say', () => {
    it('states a high-confidence value with a tick', () => {
      const row = toReviewRow('brand', attribute({ band: 'high' }));
      expect(row).toMatchObject({ display: 'Ganni', tone: 'stated', showTick: true });
    });

    it('states a medium value WITHOUT a tick', () => {
      // The tick is what makes it a claim; medium is stated but not asserted.
      const row = toReviewRow('brand', attribute({ band: 'medium' }));
      expect(row).toMatchObject({ display: 'Ganni', tone: 'stated', showTick: false });
    });

    it('asks about a low-confidence value rather than stating it', () => {
      const row = toReviewRow('brand', attribute({ band: 'low' }));
      expect(row.tone).toBe('asked');
      expect(row.display).toBe('Is this Ganni?');
      expect(row.showTick).toBe(false);
    });

    it('shows nothing at all for very low confidence', () => {
      // Mira has an opinion, but not one worth voicing — and the user must
      // never see a confidently wrong brand (§6).
      const row = toReviewRow('brand', attribute({ band: 'very_low' }));
      expect(row.display).toBeNull();
      expect(row.tone).toBe('empty');
      expect(row.placeholder).toBe('Add brand');
    });

    it('never shows a raw confidence number (D-011)', () => {
      for (const band of ['high', 'medium', 'low', 'very_low'] as const) {
        const row = toReviewRow('brand', attribute({ band }));
        expect(JSON.stringify(row)).not.toMatch(/0\.\d/);
      }
    });
  });

  describe('a user value is never questioned', () => {
    it('states a user value with a tick whatever the band says', () => {
      // Showing someone their own answer back as a question would be absurd.
      const row = toReviewRow('brand', attribute({ source: 'user', band: 'low' }));
      expect(row).toMatchObject({ tone: 'stated', showTick: true, display: 'Ganni' });
    });
  });

  describe('an absent field is an invitation, not a blank', () => {
    it('offers a placeholder when there is no attribute', () => {
      const row = toReviewRow('size', undefined);
      expect(row).toMatchObject({ display: null, tone: 'empty', placeholder: 'Add size' });
    });

    it('treats an empty list as absent', () => {
      const row = toReviewRow('materials', attribute({ field: 'materials', value: [] }));
      expect(row.tone).toBe('empty');
    });

    it('treats blank text as absent', () => {
      expect(toReviewRow('brand', attribute({ value: '   ' })).tone).toBe('empty');
    });
  });

  it('labels fields in language, not storage', () => {
    expect(toReviewRow('sleeve_length', undefined).label).toBe('Sleeve length');
  });
});

describe('displayValue', () => {
  it('humanizes snake_case', () => {
    expect(displayValue('mini_dress')).toBe('Mini dress');
  });

  it('joins a list', () => {
    expect(displayValue(['black', 'light_blue'])).toBe('Black, Light blue');
  });

  it('is null for nothing', () => {
    expect(displayValue(null)).toBeNull();
    expect(displayValue([])).toBeNull();
    expect(displayValue('')).toBeNull();
    expect(displayValue({})).toBeNull();
  });

  it('ignores non-string list members rather than rendering [object Object]', () => {
    expect(displayValue(['black', { a: 1 }, null])).toBe('Black');
  });
});

describe('buildReviewRows', () => {
  it('asks about identity before judgements', () => {
    const rows = buildReviewRows([]);
    const order = rows.map((r) => r.field);

    // Brand and category are what a person checks; season and occasion are the
    // least certain and least consequential.
    expect(order.indexOf('brand')).toBeLessThan(order.indexOf('season'));
    expect(order.indexOf('category')).toBeLessThan(order.indexOf('occasion'));
  });

  it('renders a row for every field, so nothing is silently missing', () => {
    const rows = buildReviewRows([attribute()]);
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.filter((r) => r.tone === 'empty').length).toBeGreaterThan(0);
  });

  it('never produces a screen of only empty rows when anything is known', () => {
    // CAP-2: the user must never face a form of empty fields.
    const rows = buildReviewRows([
      attribute({ field: 'category', value: 'dresses' }),
      attribute({ field: 'colors', value: ['black'] }),
      attribute({ field: 'pattern', value: 'solid' }),
    ]);
    expect(rows.some((r) => r.tone === 'stated')).toBe(true);
  });
});

describe('buildChips', () => {
  it('shows the characterful, confident fields', () => {
    const chips = buildChips([
      attribute({ field: 'subcategory', value: 'midi_dress' }),
      attribute({ field: 'colors', value: ['black'] }),
      attribute({ field: 'occasion', value: ['dinner', 'date'] }),
    ]);

    expect(chips).toEqual(['Midi dress', 'Black', 'Dinner', 'Date']);
  });

  it('omits values too uncertain to assert', () => {
    // A chip has no room for doubt, so an unsure value cannot wear one.
    const chips = buildChips([
      attribute({ field: 'colors', value: ['black'], band: 'low' }),
      attribute({ field: 'subcategory', value: 'midi_dress', band: 'high' }),
    ]);

    expect(chips).toEqual(['Midi dress']);
  });

  it('includes a user value regardless of band', () => {
    const chips = buildChips([
      attribute({ field: 'colors', value: ['black'], band: 'very_low', source: 'user' }),
    ]);
    expect(chips).toEqual(['Black']);
  });

  it('does not repeat a value that appears in two fields', () => {
    const chips = buildChips([
      attribute({ field: 'style', value: ['minimal'] }),
      attribute({ field: 'occasion', value: ['minimal'] }),
    ]);
    expect(chips).toEqual(['Minimal']);
  });

  it('is empty rather than wrong when nothing is confident', () => {
    expect(buildChips([attribute({ field: 'colors', value: ['black'], band: 'very_low' })])).toEqual(
      [],
    );
  });
});
