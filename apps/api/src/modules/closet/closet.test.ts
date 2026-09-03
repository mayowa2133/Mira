import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor.js';
import { SORT_KEYS, buildFilterSql, sortSql, validateFilters } from './filters.js';
import { parseListQuery } from './routes.js';
import { ApiError } from '../../http/errors.js';

describe('cursors', () => {
  it('round-trips', () => {
    const cursor = { value: '2026-09-03T00:00:00.000Z', id: 'abc-123' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('is opaque — not readable as plain text', () => {
    expect(encodeCursor({ value: 'v', id: 'i' })).not.toContain('v i');
  });

  it('rejects garbage rather than throwing', () => {
    expect(decodeCursor('!!!not-base64!!!')).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });

  it('handles ids containing spaces', () => {
    const cursor = { value: '2026-01-01', id: 'a b c' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });
});

describe('filter validation (INV-1, AI-3)', () => {
  it('accepts taxonomy values', () => {
    expect(() =>
      validateFilters({ category: ['dresses'], color: ['black'], status: ['active'] }),
    ).not.toThrow();
  });

  it('rejects a category outside the taxonomy with 422, not an empty result', () => {
    try {
      validateFilters({ category: ['outfits'] });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(422);
      expect((error as ApiError).code).toBe('not_in_taxonomy');
    }
  });

  it.each([
    ['color', { color: ['chartreuse'] }],
    ['season', { season: ['monsoon'] }],
    ['occasion', { occasion: ['funeral'] }],
    ['status', { status: ['in_the_wash'] }],
    ['material', { material: ['unobtanium'] }],
  ])('rejects an invalid %s', (_label, filters) => {
    expect(() => validateFilters(filters)).toThrow(ApiError);
  });

  it('rejects an inverted price range', () => {
    expect(() => validateFilters({ priceMin: 100, priceMax: 10 })).toThrow(ApiError);
  });

  it('rejects a non-positive not_worn_since_days', () => {
    expect(() => validateFilters({ notWornSinceDays: 0 })).toThrow(ApiError);
  });
});

describe('filter SQL', () => {
  it('produces no clauses for an empty filter set', () => {
    expect(buildFilterSql({}, 2)).toEqual({ clauses: [], values: [] });
  });

  it('binds every value as a parameter, never inlining', () => {
    const { clauses, values } = buildFilterSql({ category: ['dresses'], favorite: true }, 2);
    expect(clauses.join(' ')).toMatch(/\$2/);
    expect(clauses.join(' ')).toMatch(/\$3/);
    expect(values).toEqual([['dresses'], true]);
    // No literal values in the SQL text.
    expect(clauses.join(' ')).not.toContain('dresses');
  });

  it('uses overlap for array columns, so a multi-season garment still matches', () => {
    const { clauses } = buildFilterSql({ season: ['summer'] }, 2);
    expect(clauses[0]).toContain('&&');
  });

  it('uses equality for scalar columns', () => {
    const { clauses } = buildFilterSql({ category: ['dresses'] }, 2);
    expect(clauses[0]).toContain('= any(');
  });

  it('treats never-worn garments as "not worn since"', () => {
    const { clauses } = buildFilterSql({ notWornSinceDays: 90 }, 2);
    expect(clauses[0]).toContain('last_worn_at is null');
  });

  it('numbers parameters from the given start, leaving $1 for user_id', () => {
    const { clauses } = buildFilterSql({ category: ['tops'] }, 5);
    expect(clauses[0]).toContain('$5');
  });

  it('combines multiple filters with AND semantics (INV-3)', () => {
    const { clauses } = buildFilterSql(
      { category: ['dresses'], color: ['black'], favorite: true },
      2,
    );
    expect(clauses).toHaveLength(3);
  });
});

describe('sorting', () => {
  it.each(SORT_KEYS)('tie-breaks %s by id, so keyset pagination is stable', (key) => {
    expect(sortSql(key).orderBy).toContain('g.id desc');
  });

  it('puts nulls last where a null means "unknown"', () => {
    expect(sortSql('recently_worn').orderBy).toContain('nulls last');
    expect(sortSql('price_asc').orderBy).toContain('nulls last');
  });

  it('defaults to most recent', () => {
    expect(sortSql('recent').orderBy).toContain('g.created_at desc');
  });
});

describe('list query parsing', () => {
  it('applies defaults', () => {
    const parsed = parseListQuery({});
    expect(parsed.limit).toBe(40);
    expect(parsed.sort).toBe('recent');
    expect(parsed.cursor).toBeNull();
  });

  it('normalizes a single value into an array', () => {
    expect(parseListQuery({ category: 'dresses' }).filters.category).toEqual(['dresses']);
  });

  it('keeps repeated query keys as an array', () => {
    expect(parseListQuery({ category: ['dresses', 'tops'] }).filters.category).toEqual([
      'dresses',
      'tops',
    ]);
  });

  it('parses booleans from string form', () => {
    expect(parseListQuery({ favorite: 'true' }).filters.favorite).toBe(true);
    expect(parseListQuery({ never_worn: '1' }).filters.neverWorn).toBe(true);
    expect(parseListQuery({ favorite: 'false' }).filters.favorite).toBe(false);
  });

  it('rejects a limit above the maximum', () => {
    expect(() => parseListQuery({ limit: '500' })).toThrow(ApiError);
  });

  it('rejects a limit below one', () => {
    expect(() => parseListQuery({ limit: '0' })).toThrow(ApiError);
  });

  it('rejects an unknown sort key', () => {
    expect(() => parseListQuery({ sort: 'vibes' })).toThrow(ApiError);
  });

  it('omits absent filters rather than setting them undefined', () => {
    expect(Object.keys(parseListQuery({}).filters)).toHaveLength(0);
  });
});
