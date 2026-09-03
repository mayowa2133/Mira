/**
 * User scoping.
 *
 * SEC-5: users may only access their own data. Two independent mechanisms are
 * required, and neither may be the only one:
 *
 *   1. Repository scoping — enforced here.
 *   2. Row-level security — enforced in the database.
 *
 * The rule from `docs/03-architecture/backend-architecture.md` §1 is:
 *
 *   > Every repository method takes a `user_id` and filters on it. A repository
 *   > method that cannot scope by user does not exist.
 *
 * This module makes that structural rather than a convention:
 *
 *   - `UserScope` is a branded type that can only be built from an authenticated
 *     actor, so a scope cannot be conjured from a request parameter.
 *   - `scopedQuery` REFUSES to run a statement against a user-owned table
 *     unless the statement filters on user_id.
 */
import type { Queryable, QueryResultRow } from './pool.js';

declare const brand: unique symbol;

/**
 * Proof that a caller is acting on behalf of a specific authenticated user.
 * Constructible only via `userScope`, which the auth layer calls.
 */
export type UserScope = { readonly userId: string; readonly [brand]: 'UserScope' };

export function userScope(userId: string): UserScope {
  if (!userId) throw new Error('userScope requires a user id');
  return { userId } as UserScope;
}

/**
 * Tables that hold user-owned rows.
 *
 * Every table here must be filtered by user_id in every statement. Adding a
 * user-owned table without adding it here is a review failure
 * (`docs/07-security/security-rules.md` — Code review checklist).
 */
export const USER_OWNED_TABLES = [
  'garments',
  'garment_images',
  'garment_attributes',
  'garment_sources',
  'garment_embeddings',
  'garment_duplicates',
  'closets',
  'body_profiles',
  'body_profile_images',
  'purchase_candidates',
  'purchase_records',
  'receipt_imports',
  'email_connections',
  'retailer_connections',
  'outfits',
  'outfit_items',
  'wear_events',
  'favorites',
  'style_preferences',
  'recommendations',
  'try_on_generations',
  'search_history',
  'ingestion_jobs',
  'notifications',
] as const;

export type UserOwnedTable = (typeof USER_OWNED_TABLES)[number];

const TABLE_RE = new RegExp(
  `\\b(?:from|join|into|update)\\s+"?(${USER_OWNED_TABLES.join('|')})"?\\b`,
  'gi',
);
const USER_ID_PREDICATE_RE = /\buser_id\s*=\s*\$\d+/i;

/**
 * Statements that reference a user-owned table but do not filter on user_id.
 * Returns the offending table names.
 */
export function unscopedTables(sql: string): string[] {
  const withoutComments = sql.replace(/--[^\n]*/g, ' ');
  const tables = [...withoutComments.matchAll(TABLE_RE)].map((m) => (m[1] ?? '').toLowerCase());
  if (tables.length === 0) return [];
  if (USER_ID_PREDICATE_RE.test(withoutComments)) return [];
  return [...new Set(tables)];
}

export class UnscopedQueryError extends Error {
  constructor(tables: string[]) {
    super(
      `Refusing to run a query against user-owned table(s) [${tables.join(', ')}] ` +
        `without a user_id predicate. Every repository method must scope by user (SEC-5).`,
    );
    this.name = 'UnscopedQueryError';
  }
}

/**
 * Run a query on behalf of a specific user.
 *
 * The scope is a required argument, so it cannot be forgotten, and the SQL is
 * checked so it cannot be bypassed.
 */
export async function scopedQuery<T extends QueryResultRow = QueryResultRow>(
  db: Queryable,
  _scope: UserScope,
  sql: string,
  values: readonly unknown[] = [],
): Promise<{ rows: T[]; rowCount: number }> {
  const offenders = unscopedTables(sql);
  if (offenders.length > 0) throw new UnscopedQueryError(offenders);
  return db.query<T>(sql, values);
}

/**
 * Escape hatch for statements that legitimately do not touch user-owned tables
 * (migrations, health checks, global lookups such as `brands`).
 *
 * Deliberately verbose, so it stands out in review.
 */
export async function unscopedQueryForGlobalTables<T extends QueryResultRow = QueryResultRow>(
  db: Queryable,
  sql: string,
  values: readonly unknown[] = [],
): Promise<{ rows: T[]; rowCount: number }> {
  const offenders = unscopedTables(sql);
  if (offenders.length > 0) throw new UnscopedQueryError(offenders);
  return db.query<T>(sql, values);
}
