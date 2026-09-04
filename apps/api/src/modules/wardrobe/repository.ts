/**
 * Wardrobe insight queries.
 *
 * Everything here reads from `worn_count` and `last_worn_at`, which are derived
 * from `wear_events` by a trigger (migrations 0006/0007). That is why these can
 * be plain indexed queries rather than aggregations over the event log — and
 * why the trigger being right matters more than any query in this file.
 */
import type { Queryable } from '../../db/pool.js';
import { scopedQuery, type UserScope } from '../../db/scope.js';
import { FORGOTTEN_DAYS, SETTLING_IN_DAYS } from './rules.js';

export type InsightGarmentRow = {
  /**
   * How many pieces qualify in total, before the rail's limit.
   *
   * The headline counts the whole insight while the rail shows a preview —
   * "17 pieces deserve another chance" with three on screen and an arrow
   * (screen-specs.md §26). Reporting the rail length instead understates it,
   * and understates it more the more there is to say.
   */
  total_count: string;
  id: string;
  name: string | null;
  brand_raw: string | null;
  category: string;
  primary_color: string | null;
  purchase_price: string | null;
  currency: string | null;
  worn_count: number;
  last_worn_at: Date | null;
  created_at: Date;
};

/** Only active pieces: an archived garment is not neglected, it is gone. */
const ACTIVE = `g.deleted_at is null and g.status not in ('archived','sold','donated','lost','returned')`;

const COLUMNS = `
  count(*) over () as total_count,
  g.id, g.name, g.brand_raw, g.category, g.primary_color,
  g.purchase_price::text as purchase_price, g.currency,
  g.worn_count, g.last_worn_at, g.created_at
`;

export class WardrobeRepository {
  constructor(private readonly db: Queryable) {}

  async closetSize(scope: UserScope): Promise<number> {
    const { rows } = await scopedQuery<{ count: string }>(
      this.db,
      scope,
      `select count(*) as count from garments g where g.user_id = $1 and ${ACTIVE}`,
      [scope.userId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  /**
   * Worn once, then not for a long time.
   *
   * Deliberately excludes never-worn pieces — those have their own section, and
   * lumping them together turns two different feelings ("I forgot about this"
   * and "I never wore this") into one undifferentiated pile.
   */
  async forgotten(scope: UserScope, limit: number): Promise<InsightGarmentRow[]> {
    const { rows } = await scopedQuery<InsightGarmentRow>(
      this.db,
      scope,
      `select ${COLUMNS}
         from garments g
        where g.user_id = $1 and ${ACTIVE}
          and g.worn_count > 0
          and g.last_worn_at < now() - ($2 || ' days')::interval
        order by g.last_worn_at asc
        limit $3`,
      [scope.userId, String(FORGOTTEN_DAYS), limit],
    );
    return rows;
  }

  /**
   * Never worn, and owned long enough for that to mean something.
   *
   * Without the settling-in window, everything imported last week would be
   * reported as neglected the moment the import finished.
   */
  async neverWorn(scope: UserScope, limit: number): Promise<InsightGarmentRow[]> {
    const { rows } = await scopedQuery<InsightGarmentRow>(
      this.db,
      scope,
      `select ${COLUMNS}
         from garments g
        where g.user_id = $1 and ${ACTIVE}
          and g.worn_count = 0
          and g.created_at < now() - ($2 || ' days')::interval
        order by g.created_at asc
        limit $3`,
      [scope.userId, String(SETTLING_IN_DAYS), limit],
    );
    return rows;
  }

  /** Still has its tags: bought, never worn, and the user knows it. */
  async tagsAttached(scope: UserScope, limit: number): Promise<InsightGarmentRow[]> {
    const { rows } = await scopedQuery<InsightGarmentRow>(
      this.db,
      scope,
      `select ${COLUMNS}
         from garments g
        where g.user_id = $1 and ${ACTIVE} and g.tags_attached
        order by g.created_at asc
        limit $2`,
      [scope.userId, limit],
    );
    return rows;
  }

  async mostLoved(scope: UserScope, limit: number): Promise<InsightGarmentRow[]> {
    const { rows } = await scopedQuery<InsightGarmentRow>(
      this.db,
      scope,
      `select ${COLUMNS}
         from garments g
        where g.user_id = $1 and ${ACTIVE} and g.worn_count > 0
        order by g.worn_count desc, g.last_worn_at desc
        limit $2`,
      [scope.userId, limit],
    );
    return rows;
  }

  /** Prices and wear counts for the aggregate stats. */
  /** Named garments, for a surface that already knows which ids it wants. */
  async insightGarments(scope: UserScope, ids: string[]): Promise<InsightGarmentRow[]> {
    if (ids.length === 0) return [];
    const { rows } = await scopedQuery<InsightGarmentRow>(
      this.db,
      scope,
      `select ${COLUMNS}
         from garments g
        where g.user_id = $1 and ${ACTIVE} and g.id = any($2::uuid[])`,
      [scope.userId, ids],
    );
    return rows;
  }

  async priceAndWear(
    scope: UserScope,
  ): Promise<{ purchase_price: string | null; currency: string | null; worn_count: number }[]> {
    const { rows } = await scopedQuery<{
      purchase_price: string | null;
      currency: string | null;
      worn_count: number;
    }>(
      this.db,
      scope,
      `select g.purchase_price::text as purchase_price, g.currency, g.worn_count
         from garments g
        where g.user_id = $1 and ${ACTIVE}`,
      [scope.userId],
    );
    return rows;
  }

  /** Wears in a window, for the history calendar. */
  async wearHistory(
    scope: UserScope,
    range: { from: string; to: string },
  ): Promise<{ worn_on: string; garment_id: string | null; outfit_id: string | null }[]> {
    const { rows } = await scopedQuery<{
      worn_on: string;
      garment_id: string | null;
      outfit_id: string | null;
    }>(
      this.db,
      scope,
      `select worn_on::text as worn_on, garment_id, outfit_id
         from wear_events
        where user_id = $1 and worn_on between $2::date and $3::date
        order by worn_on desc`,
      [scope.userId, range.from, range.to],
    );
    return rows;
  }
}
