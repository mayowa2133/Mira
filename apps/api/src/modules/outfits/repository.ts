/**
 * Outfits, their items, and wear events.
 *
 * `worn_count` and `last_worn_at` are never written here — a database trigger
 * derives them from `wear_events` (migration 0006). Any code that set them
 * directly would be a second source of truth for a number the closet reports,
 * and the first one to drift would be believed.
 */
import type { Queryable } from '../../db/pool.js';
import { scopedQuery, type UserScope } from '../../db/scope.js';

export type OutfitRow = {
  id: string;
  name: string | null;
  occasion: string | null;
  season: string[];
  origin: string;
  cover_image_key: string | null;
  favorite: boolean;
  worn_count: number;
  last_worn_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type OutfitItemRow = {
  outfit_id: string;
  garment_id: string;
  slot: string;
  position: number;
};

export type CreateOutfitInput = {
  name: string | null;
  occasion: string | null;
  season: string[];
  origin: 'user' | 'mira';
  items: { garmentId: string; slot: string; position: number }[];
};

/** Which looks a tab shows (`screen-specs.md` §22). */
export type OutfitTab = 'saved' | 'worn' | 'mira' | 'mine';

export class OutfitRepository {
  constructor(private readonly db: Queryable) {}

  async list(scope: UserScope, tab: OutfitTab, limit: number): Promise<OutfitRow[]> {
    // Each tab is a different question, not a filter on one list: "saved" is
    // what the user kept, "worn" is what they actually wore.
    const where =
      tab === 'saved'
        ? 'and o.favorite'
        : tab === 'worn'
          ? 'and o.worn_count > 0'
          : tab === 'mira'
            ? "and o.origin = 'mira'"
            : "and o.origin = 'user'";

    const order = tab === 'worn' ? 'o.last_worn_at desc nulls last' : 'o.created_at desc';

    const { rows } = await scopedQuery<OutfitRow>(
      this.db,
      scope,
      `select o.id, o.name, o.occasion, o.season, o.origin, o.cover_image_key,
              o.favorite, o.worn_count, o.last_worn_at, o.created_at, o.updated_at
         from outfits o
        where o.user_id = $1 and o.deleted_at is null ${where}
        order by ${order}
        limit $2`,
      [scope.userId, limit],
    );
    return rows;
  }

  async findById(scope: UserScope, id: string): Promise<OutfitRow | null> {
    const { rows } = await scopedQuery<OutfitRow>(
      this.db,
      scope,
      `select id, name, occasion, season, origin, cover_image_key, favorite,
              worn_count, last_worn_at, created_at, updated_at
         from outfits
        where user_id = $1 and id = $2 and deleted_at is null`,
      [scope.userId, id],
    );
    return rows[0] ?? null;
  }

  async itemsFor(scope: UserScope, outfitIds: string[]): Promise<OutfitItemRow[]> {
    if (outfitIds.length === 0) return [];
    const { rows } = await scopedQuery<OutfitItemRow>(
      this.db,
      scope,
      `select outfit_id, garment_id, slot, position
         from outfit_items
        where user_id = $1 and outfit_id = any($2::uuid[])
        order by outfit_id, position`,
      [scope.userId, outfitIds],
    );
    return rows;
  }

  /**
   * Create a look and its items together.
   *
   * One transaction: an outfit with no items is not a look, it is a row nobody
   * can explain, and the Looks library would render an empty card for it.
   */
  async create(scope: UserScope, input: CreateOutfitInput): Promise<OutfitRow> {
    const { rows } = await scopedQuery<{ id: string }>(
      this.db,
      scope,
      `insert into outfits (user_id, name, occasion, season, origin)
       values ($1, $2, $3, $4, $5) returning id`,
      [scope.userId, input.name, input.occasion, input.season, input.origin],
    );

    const id = rows[0]?.id;
    if (!id) throw new Error('outfit insert returned no id');

    for (const item of input.items) {
      await scopedQuery(
        this.db,
        scope,
        `insert into outfit_items (outfit_id, garment_id, user_id, slot, position)
         values ($2, $3, $1, $4, $5)`,
        [scope.userId, id, item.garmentId, item.slot, item.position],
      );
    }

    const created = await this.findById(scope, id);
    if (!created) throw new Error('outfit disappeared immediately after creation');
    return created;
  }

  /** Garments the user owns, of those requested. Filters out anything else. */
  async ownedGarmentIds(scope: UserScope, garmentIds: string[]): Promise<Set<string>> {
    if (garmentIds.length === 0) return new Set();
    const { rows } = await scopedQuery<{ id: string }>(
      this.db,
      scope,
      `select id from garments
        where user_id = $1 and id = any($2::uuid[]) and deleted_at is null`,
      [scope.userId, garmentIds],
    );
    return new Set(rows.map((row) => row.id));
  }

  async setFavorite(scope: UserScope, id: string, favorite: boolean): Promise<OutfitRow | null> {
    await scopedQuery(
      this.db,
      scope,
      `update outfits set favorite = $3 where user_id = $1 and id = $2 and deleted_at is null`,
      [scope.userId, id, favorite],
    );
    return this.findById(scope, id);
  }

  async softDelete(scope: UserScope, id: string): Promise<boolean> {
    const { rowCount } = await scopedQuery(
      this.db,
      scope,
      `update outfits set deleted_at = now()
        where user_id = $1 and id = $2 and deleted_at is null`,
      [scope.userId, id],
    );
    return (rowCount ?? 0) > 0;
  }

  /**
   * Record a wear.
   *
   * `garments.worn_count` follows from the trigger; nothing here touches it.
   */
  async recordWear(
    scope: UserScope,
    input: {
      garmentId: string | null;
      outfitId: string | null;
      wornOn: string;
      note: string | null;
    },
  ): Promise<{ id: string }> {
    const { rows } = await scopedQuery<{ id: string }>(
      this.db,
      scope,
      `insert into wear_events (user_id, garment_id, outfit_id, worn_on, note)
       values ($1, $2, $3, $4::date, $5) returning id`,
      [scope.userId, input.garmentId, input.outfitId, input.wornOn, input.note],
    );

    const id = rows[0]?.id;
    if (!id) throw new Error('wear event insert returned no id');
    return { id };
  }

  async wearEvents(
    scope: UserScope,
    range: { from: string | null; to: string | null; limit: number },
  ) {
    const { rows } = await scopedQuery<{
      id: string;
      garment_id: string | null;
      outfit_id: string | null;
      worn_on: string;
      note: string | null;
    }>(
      this.db,
      scope,
      `select id, garment_id, outfit_id, worn_on::text as worn_on, note
         from wear_events
        where user_id = $1
          and ($2::date is null or worn_on >= $2::date)
          and ($3::date is null or worn_on <= $3::date)
        order by worn_on desc, created_at desc
        limit $4`,
      [scope.userId, range.from, range.to, range.limit],
    );
    return rows;
  }

  async deleteWearEvent(scope: UserScope, id: string): Promise<boolean> {
    const { rowCount } = await scopedQuery(
      this.db,
      scope,
      `delete from wear_events where user_id = $1 and id = $2`,
      [scope.userId, id],
    );
    return (rowCount ?? 0) > 0;
  }
}
