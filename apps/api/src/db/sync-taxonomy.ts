/**
 * Synchronize the `categories` table with the canonical taxonomy.
 *
 * `categories` is a materialization of `docs/04-data/taxonomy.md` §1 —
 * generated, never hand-edited. It runs as part of `db:migrate` rather than
 * `db:seed` because it is REFERENCE data, not sample data: `garments.category`
 * has a foreign key to it, so a migrated-but-unseeded database would otherwise
 * be unable to hold a single garment.
 *
 * Idempotent, and additive-only. A value removed from the taxonomy is
 * deactivated rather than deleted, because existing garments may still
 * reference it — removing a taxonomy value requires a migration that remaps
 * those rows first (`docs/04-data/migrations.md` — Taxonomy changes).
 */
import { CATEGORIES, CATEGORY_SUBCATEGORIES } from '@mira/taxonomy';
import type { Queryable } from './pool.js';

export type TaxonomySyncResult = { categories: number; subcategories: number; deactivated: number };

export async function syncTaxonomy(db: Queryable): Promise<TaxonomySyncResult> {
  const active: string[] = [];

  // Top-level categories first, so subcategories can reference them.
  for (const [index, category] of CATEGORIES.entries()) {
    await db.query(
      `insert into categories (id, parent_id, display_order, is_active)
       values ($1, null, $2, true)
       on conflict (id) do update
         set parent_id = null, display_order = excluded.display_order, is_active = true`,
      [category, index],
    );
    active.push(category);
  }

  let subcategories = 0;
  for (const category of CATEGORIES) {
    const subs = CATEGORY_SUBCATEGORIES[category];
    for (const [index, sub] of subs.entries()) {
      // `other` appears under several categories; it is stored once, scoped by
      // its own id, and its parent is whichever category first declared it.
      const id = sub === 'other' ? `${category}_other` : sub;
      await db.query(
        `insert into categories (id, parent_id, display_order, is_active)
         values ($1, $2, $3, true)
         on conflict (id) do update
           set parent_id = excluded.parent_id,
               display_order = excluded.display_order,
               is_active = true`,
        [id, category, index],
      );
      active.push(id);
      subcategories += 1;
    }
  }

  const { rowCount } = await db.query(
    `update categories set is_active = false
      where is_active and not (id = any($1::text[]))`,
    [active],
  );

  return { categories: CATEGORIES.length, subcategories, deactivated: rowCount ?? 0 };
}

/**
 * Resolve a taxonomy subcategory to its `categories.id`.
 *
 * `other` is stored per category (`dresses_other`, `shoes_other`, …) so the
 * parent relationship stays meaningful and `dresses/other` cannot be confused
 * with `shoes/other`.
 */
export function categoryRowId(category: string, subcategory: string | null): string | null {
  if (subcategory === null) return null;
  return subcategory === 'other' ? `${category}_other` : subcategory;
}

/** Inverse of `categoryRowId`, for reading rows back out. */
export function subcategoryFromRowId(rowId: string | null): string | null {
  if (rowId === null) return null;
  return rowId.endsWith('_other') ? 'other' : rowId;
}
