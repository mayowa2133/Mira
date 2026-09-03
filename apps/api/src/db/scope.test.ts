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

  // An INSERT has no WHERE clause to filter on, so it scopes differently: it
  // must NAME user_id among its columns, so a row cannot be created ownerless.
  it('flags an insert that does not name user_id', () => {
    expect(unscopedTables('insert into wear_events (id, worn_on) values ($1, $2)')).toEqual([
      'wear_events',
    ]);
  });

  it('accepts an insert that names user_id among its columns', () => {
    expect(
      unscopedTables('insert into wear_events (user_id, garment_id, worn_on) values ($1, $2, $3)'),
    ).toEqual([]);
  });

  it('accepts an upsert that names user_id, including its on-conflict clause', () => {
    const sql = `insert into closets (user_id, name, is_default)
                 values ($1, 'My closet', true)
                 on conflict (user_id) where is_default
                 do update set name = closets.name
                 returning id, user_id, name, is_default`;
    expect(unscopedTables(sql)).toEqual([]);
  });

  it('still requires a predicate on the SELECT side of an insert...select', () => {
    expect(
      unscopedTables('insert into outfit_items (user_id, garment_id) select $1, id from garments'),
    ).toEqual(['garments']);
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
