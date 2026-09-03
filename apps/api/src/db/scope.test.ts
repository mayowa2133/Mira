import { describe, expect, it, vi } from 'vitest';
import {
  UnscopedQueryError,
  USER_OWNED_TABLES,
  scopedQuery,
  unscopedTables,
  userScope,
} from './scope.js';
import type { Queryable } from './pool.js';

const fakeDb = (): Queryable => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
});

describe('user scoping (SEC-5)', () => {
  it('builds a scope from a user id', () => {
    expect(userScope('u1').userId).toBe('u1');
  });

  it('refuses to build a scope from an empty id', () => {
    expect(() => userScope('')).toThrow();
  });
});

describe('unscopedTables', () => {
  it('flags a select on a user-owned table with no user_id predicate', () => {
    expect(unscopedTables('select * from garments where id = $1')).toEqual(['garments']);
  });

  it('accepts a select that filters on user_id', () => {
    expect(unscopedTables('select * from garments where user_id = $1 and id = $2')).toEqual([]);
  });

  it('flags an update with no user_id predicate', () => {
    expect(unscopedTables('update outfits set name = $1 where id = $2')).toEqual(['outfits']);
  });

  it('flags an insert into a user-owned table', () => {
    expect(unscopedTables('insert into wear_events (id) values ($1)')).toEqual(['wear_events']);
  });

  it('flags a join onto a user-owned table', () => {
    expect(unscopedTables('select * from brands b join garments g on g.brand_id = b.id')).toEqual([
      'garments',
    ]);
  });

  it('ignores global tables', () => {
    expect(unscopedTables('select * from brands where normalized_name = $1')).toEqual([]);
    expect(unscopedTables('select 1')).toEqual([]);
  });

  it('is not fooled by a user_id mentioned only in a comment', () => {
    expect(unscopedTables('select * from garments -- user_id = $1\n where id = $2')).toEqual([
      'garments',
    ]);
  });

  it('is not fooled by a literal user_id comparison that is not a bound parameter', () => {
    // user_id = 'anything' cannot be a scope: scopes are always bound params.
    expect(unscopedTables("select * from garments where user_id = 'abc'")).toEqual(['garments']);
  });
});

describe('scopedQuery', () => {
  it('runs a properly scoped query', async () => {
    const db = fakeDb();
    await scopedQuery(db, userScope('u1'), 'select * from garments where user_id = $1', ['u1']);
    expect(db.query).toHaveBeenCalledOnce();
  });

  it('throws rather than running an unscoped query', async () => {
    const db = fakeDb();
    await expect(
      scopedQuery(db, userScope('u1'), 'select * from garments where id = $1', ['g1']),
    ).rejects.toBeInstanceOf(UnscopedQueryError);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('names the offending table so the failure is actionable', async () => {
    const db = fakeDb();
    await expect(
      scopedQuery(db, userScope('u1'), 'select * from try_on_generations', []),
    ).rejects.toThrow(/try_on_generations/);
  });
});

describe('the user-owned table list', () => {
  it('covers every private entity named in the security rules', () => {
    for (const table of [
      'garments',
      'body_profiles',
      'body_profile_images',
      'try_on_generations',
      'purchase_candidates',
      'email_connections',
      'outfits',
      'wear_events',
    ]) {
      expect(USER_OWNED_TABLES).toContain(table);
    }
  });
});
