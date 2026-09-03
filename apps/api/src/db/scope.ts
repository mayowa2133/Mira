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
  `\\b(from|join|into|update)\\s+"?(${USER_OWNED_TABLES.join('|')})"?\\b`,
  'gi',
);
const USER_ID_PREDICATE_RE = /\buser_id\s*=\s*\$\d+/i;
const INSERT_TARGET_RE = new RegExp(
  `\\binsert\\s+into\\s+"?(${USER_OWNED_TABLES.join('|')})"?\\s*\\(([^)]*)\\)`,
  'i',
);

/**
 * Statements that reference a user-owned table without scoping to a user.
 * Returns the offending table names.
 *
 * Two different things count as "scoped", because reads and writes scope
 * differently:
 *
 *   SELECT / UPDATE / DELETE  filter on the user: `... where user_id = $1`
 *   INSERT                    SUPPLY the user: `insert into t (user_id, ...)`
 *
 * An INSERT has no WHERE clause to filter on, so requiring a predicate there
 * would reject every correct write. What it must do instead is name `user_id`
 * among its columns, so a row cannot be created without an owner.
 */
export function unscopedTables(sql: string): string[] {
  const withoutComments = sql.replace(/--[^\n]*/g, ' ');
  const hasUserPredicate = USER_ID_PREDICATE_RE.test(withoutComments);

  const insertMatch = INSERT_TARGET_RE.exec(withoutComments);
  const insertTarget = insertMatch?.[1]?.toLowerCase() ?? null;
  const insertNamesUserId = /\buser_id\b/i.test(insertMatch?.[2] ?? '');

  const offenders = new Set<string>();

  for (const match of withoutComments.matchAll(TABLE_RE)) {
    const clause = (match[1] ?? '').toLowerCase();
    const table = (match[2] ?? '').toLowerCase();

    // The INSERT target scopes by naming user_id among its columns.
    if (clause === 'into' && table === insertTarget) {
      if (!insertNamesUserId) offenders.add(table);
      continue;
    }

    // Everything else — including the SELECT side of an INSERT ... SELECT —
    // must filter on the user.
    if (!hasUserPredicate) offenders.add(table);
  }

  return [...offenders];
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
