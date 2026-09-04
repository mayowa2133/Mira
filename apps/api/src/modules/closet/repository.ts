/**
 * Garment repository.
 *
 * Every method takes a `UserScope` and every statement filters on `user_id`.
 * A method that cannot scope by user does not exist (SEC-5,
 * `docs/03-architecture/backend-architecture.md` §1).
 */
import type { Queryable } from '../../db/pool.js';
import { scopedQuery, type UserScope } from '../../db/scope.js';
import { categoryRowId, subcategoryFromRowId } from '../../db/sync-taxonomy.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import { buildFilterSql, sortSql, type GarmentFilters, type SortKey } from './filters.js';

export type GarmentRow = {
  id: string;
  user_id: string;
  closet_id: string;
  name: string | null;
  brand_id: string | null;
  brand_raw: string | null;
  brand_name: string | null;
  category: string;
  subcategory: string | null;
  primary_color: string | null;
  secondary_colors: string[];
  pattern: string | null;
  materials: string[];
  size_raw: string | null;
  size_normalized: string | null;
  size_system: string | null;
  fit: string | null;
  season: string[];
  occasion: string[];
  style_tags: string[];
  purchase_date: Date | null;
  purchase_price: string | null;
  currency: string | null;
  retailer: string | null;
  sku: string | null;
  barcode: string | null;
  product_url: string | null;
  source_type: string;
  source_reference: string | null;
  status: string;
  favorite: boolean;
  worn_count: number;
  last_worn_at: Date | null;
  tags_attached: boolean | null;
  notes: string | null;
  analysis_state: string;
  ai_confidence: string | null;
  created_at: Date;
  updated_at: Date;
  cursor_created_at: string;
  cursor_last_worn_at: string | null;
};

export type GarmentImageRow = {
  id: string;
  garment_id: string;
  kind: string;
  storage_key: string;
  thumb_key: string | null;
  medium_key: string | null;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  is_canonical: boolean;
  position: number;
};

export type CreateGarmentInput = {
  closetId: string;
  name: string | null;
  brandRaw: string | null;
  category: string;
  subcategory: string | null;
  primaryColor: string | null;
  secondaryColors: string[];
  pattern: string | null;
  materials: string[];
  sizeRaw: string | null;
  sizeNormalized: string | null;
  sizeSystem: string | null;
  fit: string | null;
  season: string[];
  occasion: string[];
  styleTags: string[];
  purchaseDate: string | null;
  purchasePrice: number | null;
  currency: string | null;
  retailer: string | null;
  sku: string | null;
  barcode: string | null;
  productUrl: string | null;
  sourceType: string;
  sourceReference: string | null;
  tagsAttached: boolean | null;
  notes: string | null;
  /**
   * Overrides the default derived from `sourceType`.
   *
   * A photo import creates the garment already `analyzing`, because the job is
   * enqueued in the same request and the closet should show that state from the
   * first render rather than a garment that looks finished and then changes.
   */
  analysisState?: 'pending' | 'analyzing' | 'complete' | 'failed' | 'skipped';
};

export type UpdateGarmentInput = Partial<Omit<CreateGarmentInput, 'closetId' | 'sourceType'>>;

export type ListParams = {
  filters: GarmentFilters;
  sort: SortKey;
  limit: number;
  cursor: string | null;
};

export type ListResult = { rows: GarmentRow[]; nextCursor: string | null };

/**
 * Columns selected for every garment read.
 *
 * `brand_name` is joined rather than denormalized: brands are global, and a
 * brand rename should not require touching every garment.
 */
const GARMENT_COLUMNS = `
  g.id, g.user_id, g.closet_id, g.name, g.brand_id, g.brand_raw, b.name as brand_name,
  g.category, g.subcategory, g.primary_color, g.secondary_colors, g.pattern, g.materials,
  g.size_raw, g.size_normalized, g.size_system, g.fit,
  g.season, g.occasion, g.style_tags,
  g.purchase_date, g.purchase_price, g.currency, g.retailer,
  g.sku, g.barcode, g.product_url,
  g.source_type, g.source_reference, g.status,
  g.favorite, g.worn_count, g.last_worn_at, g.tags_attached, g.notes,
  g.analysis_state, g.ai_confidence, g.created_at, g.updated_at,
  -- Cursor keys are taken as TEXT straight from Postgres. Round-tripping a
  -- timestamptz through a JS Date truncates microseconds to milliseconds, and
  -- a truncated cursor silently SKIPS every row inside the lost window.
  g.created_at::text as cursor_created_at,
  g.last_worn_at::text as cursor_last_worn_at
`;

export class GarmentRepository {
  constructor(private readonly db: Queryable) {}

  async list(scope: UserScope, params: ListParams): Promise<ListResult> {
    const { orderBy, keyColumn } = sortSql(params.sort);

    // $1 is always user_id: the scope guard checks for that predicate, and it
    // is also the leading column of every index on this table.
    const values: unknown[] = [scope.userId];
    const clauses = ['g.user_id = $1', 'g.deleted_at is null'];

    const filterSql = buildFilterSql(params.filters, values.length + 1);
    clauses.push(...filterSql.clauses);
    values.push(...filterSql.values);

    // Keyset pagination. Only the default `recent` sort has a strict keyset
    // predicate; other sorts fall back to the created_at key, which is stable
    // because every sort is tie-broken by id.
    const cursor = params.cursor ? decodeCursor(params.cursor) : null;
    if (cursor) {
      clauses.push(
        `(g.${keyColumn}, g.id) < ($${values.length + 1}::timestamptz, $${values.length + 2}::uuid)`,
      );
      values.push(cursor.value, cursor.id);
    }

    // Fetch one extra row to decide whether a next page exists, without a
    // second COUNT query.
    values.push(params.limit + 1);

    const sql = `
      select ${GARMENT_COLUMNS}
        from garments g
        left join brands b on b.id = g.brand_id
       where ${clauses.join(' and ')}
       order by ${orderBy}
       limit $${values.length}
    `;

    const { rows } = await scopedQuery<GarmentRow>(this.db, scope, sql, values);

    const hasMore = rows.length > params.limit;
    const page = hasMore ? rows.slice(0, params.limit) : rows;
    const last = page[page.length - 1];

    const nextCursor =
      hasMore && last
        ? encodeCursor({
            value:
              keyColumn === 'last_worn_at'
                ? (last.cursor_last_worn_at ?? last.cursor_created_at)
                : last.cursor_created_at,
            id: last.id,
          })
        : null;

    return { rows: page, nextCursor };
  }

  async count(scope: UserScope, filters: GarmentFilters): Promise<number> {
    const values: unknown[] = [scope.userId];
    const clauses = ['g.user_id = $1', 'g.deleted_at is null'];

    const filterSql = buildFilterSql(filters, values.length + 1);
    clauses.push(...filterSql.clauses);
    values.push(...filterSql.values);

    const { rows } = await scopedQuery<{ count: string }>(
      this.db,
      scope,
      `select count(*) as count from garments g where ${clauses.join(' and ')}`,
      values,
    );
    return Number(rows[0]?.count ?? 0);
  }

  /** Counts per top-level category, for the closet summary and category chips. */
  async countsByCategory(scope: UserScope): Promise<{ category: string; count: number }[]> {
    const { rows } = await scopedQuery<{ category: string; count: string }>(
      this.db,
      scope,
      `select g.category, count(*) as count
         from garments g
        where g.user_id = $1 and g.deleted_at is null and g.status <> 'archived'
        group by g.category
        order by count desc`,
      [scope.userId],
    );
    return rows.map((r) => ({ category: r.category, count: Number(r.count) }));
  }

  async findById(scope: UserScope, id: string): Promise<GarmentRow | null> {
    const { rows } = await scopedQuery<GarmentRow>(
      this.db,
      scope,
      `select ${GARMENT_COLUMNS}
         from garments g
         left join brands b on b.id = g.brand_id
        where g.user_id = $1 and g.id = $2 and g.deleted_at is null`,
      [scope.userId, id],
    );
    return rows[0] ?? null;
  }

  async imagesFor(scope: UserScope, garmentIds: string[]): Promise<GarmentImageRow[]> {
    if (garmentIds.length === 0) return [];
    const { rows } = await scopedQuery<GarmentImageRow>(
      this.db,
      scope,
      `select id, garment_id, kind, storage_key, thumb_key, medium_key,
              width, height, blurhash, is_canonical, position
         from garment_images
        where user_id = $1 and garment_id = any($2::uuid[]) and deleted_at is null
        order by garment_id, position`,
      [scope.userId, garmentIds],
    );
    return rows;
  }

  async create(scope: UserScope, input: CreateGarmentInput): Promise<GarmentRow> {
    const { rows } = await scopedQuery<{ id: string }>(
      this.db,
      scope,
      `insert into garments (
         user_id, closet_id, name, brand_raw, category, subcategory,
         primary_color, secondary_colors, pattern, materials,
         size_raw, size_normalized, size_system, fit,
         season, occasion, style_tags,
         purchase_date, purchase_price, currency, retailer,
         sku, barcode, product_url,
         source_type, source_reference, tags_attached, notes,
         analysis_state
       ) values (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10,
         $11, $12, $13, $14,
         $15, $16, $17,
         $18, $19, $20, $21,
         $22, $23, $24,
         $25, $26, $27, $28,
         $29
       ) returning id`,
      [
        scope.userId,
        input.closetId,
        input.name,
        input.brandRaw,
        input.category,
        categoryRowId(input.category, input.subcategory),
        input.primaryColor,
        input.secondaryColors,
        input.pattern,
        input.materials,
        input.sizeRaw,
        input.sizeNormalized,
        input.sizeSystem,
        input.fit,
        input.season,
        input.occasion,
        input.styleTags,
        input.purchaseDate,
        input.purchasePrice,
        input.currency,
        input.retailer,
        input.sku,
        input.barcode,
        input.productUrl,
        input.sourceType,
        input.sourceReference,
        input.tagsAttached,
        input.notes,
        // Manually entered garments need no analysis: the user told us.
        input.analysisState ?? (input.sourceType === 'manual' ? 'skipped' : 'pending'),
      ],
    );

    const id = rows[0]?.id;
    if (!id) throw new Error('garment insert returned no id');

    // Provenance is written once, alongside creation, and never updated (CAP-3).
    await scopedQuery(
      this.db,
      scope,
      `insert into garment_sources (garment_id, user_id, source_type, reference_id)
       values ($2, $1, $3, $4)`,
      [scope.userId, id, input.sourceType, input.sourceReference],
    );

    const created = await this.findById(scope, id);
    if (!created) throw new Error('garment disappeared immediately after creation');
    return created;
  }

  /**
   * Update mutable fields.
   *
   * `source_type` and `closet_id` are absent from `UpdateGarmentInput` by
   * construction: provenance is immutable (CAP-3), and the route rejects an
   * attempt to send it with `immutable_field`.
   */
  async update(
    scope: UserScope,
    id: string,
    input: UpdateGarmentInput,
  ): Promise<GarmentRow | null> {
    const assignments: string[] = [];
    const values: unknown[] = [scope.userId, id];
    let i = 3;

    const set = (column: string, value: unknown) => {
      if (value === undefined) return;
      assignments.push(`${column} = $${i}`);
      values.push(value);
      i += 1;
    };

    set('name', input.name);
    set('brand_raw', input.brandRaw);
    set('category', input.category);
    if (input.subcategory !== undefined) {
      const category = input.category ?? (await this.findById(scope, id))?.category ?? null;
      set('subcategory', category ? categoryRowId(category, input.subcategory) : null);
    }
    set('primary_color', input.primaryColor);
    set('secondary_colors', input.secondaryColors);
    set('pattern', input.pattern);
    set('materials', input.materials);
    set('size_raw', input.sizeRaw);
    set('size_normalized', input.sizeNormalized);
    set('size_system', input.sizeSystem);
    set('fit', input.fit);
    set('season', input.season);
    set('occasion', input.occasion);
    set('style_tags', input.styleTags);
    set('purchase_date', input.purchaseDate);
    set('purchase_price', input.purchasePrice);
    set('currency', input.currency);
    set('retailer', input.retailer);
    set('sku', input.sku);
    set('barcode', input.barcode);
    set('product_url', input.productUrl);
    set('tags_attached', input.tagsAttached);
    set('notes', input.notes);

    if (assignments.length === 0) return this.findById(scope, id);

    const { rowCount } = await scopedQuery(
      this.db,
      scope,
      `update garments set ${assignments.join(', ')}
        where user_id = $1 and id = $2 and deleted_at is null`,
      values,
    );
    if (rowCount === 0) return null;
    return this.findById(scope, id);
  }

  async setFavorite(scope: UserScope, id: string, favorite: boolean): Promise<GarmentRow | null> {
    const { rowCount } = await scopedQuery(
      this.db,
      scope,
      `update garments set favorite = $3
        where user_id = $1 and id = $2 and deleted_at is null`,
      [scope.userId, id, favorite],
    );
    if (rowCount === 0) return null;
    return this.findById(scope, id);
  }

  async setStatus(scope: UserScope, id: string, status: string): Promise<GarmentRow | null> {
    const { rowCount } = await scopedQuery(
      this.db,
      scope,
      `update garments set status = $3
        where user_id = $1 and id = $2 and deleted_at is null`,
      [scope.userId, id, status],
    );
    if (rowCount === 0) return null;
    return this.findById(scope, id);
  }

  /** Soft delete. Recoverable for the undo window (`docs/07-security/data-retention.md`). */
  async softDelete(scope: UserScope, id: string): Promise<boolean> {
    const { rowCount } = await scopedQuery(
      this.db,
      scope,
      `update garments set deleted_at = now()
        where user_id = $1 and id = $2 and deleted_at is null`,
      [scope.userId, id],
    );
    return rowCount > 0;
  }

  async restore(scope: UserScope, id: string): Promise<GarmentRow | null> {
    const { rowCount } = await scopedQuery(
      this.db,
      scope,
      `update garments set deleted_at = null
        where user_id = $1 and id = $2 and deleted_at is not null`,
      [scope.userId, id],
    );
    if (rowCount === 0) return null;
    return this.findById(scope, id);
  }

  /** Resolve a brand name to a global brand row, creating it if new. */
  async resolveBrand(name: string): Promise<{ id: string; name: string } | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (!normalized) return null;

    // brands is global, not user-owned, so it is not a scoped query.
    const { rows } = await this.db.query<{ id: string; name: string }>(
      `insert into brands (name, normalized_name)
       values ($1, $2)
       on conflict (normalized_name) do update set name = brands.name
       returning id, name`,
      [trimmed, normalized],
    );
    return rows[0] ?? null;
  }

  async attachBrand(scope: UserScope, garmentId: string, brandId: string): Promise<void> {
    await scopedQuery(
      this.db,
      scope,
      `update garments set brand_id = $3 where user_id = $1 and id = $2`,
      [scope.userId, garmentId, brandId],
    );
  }
}

export { subcategoryFromRowId };
