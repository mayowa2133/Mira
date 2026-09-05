/**
 * Purchase candidate storage.
 *
 * Every method takes a `UserScope` and filters on `user_id` (SEC-5).
 *
 * `email_connections` tokens are deliberately absent from every select in this
 * file. They are never returned by any API response, and the surest way to
 * keep that true is for the rows never to carry them out of the database.
 */
import type { Queryable } from '../../db/pool.js';
import { scopedQuery, type UserScope } from '../../db/scope.js';

export type CandidateRow = {
  id: string;
  source_type: string;
  source_id: string;
  retailer: string | null;
  order_number: string | null;
  purchase_date: Date | null;
  purchase_price: string | null;
  currency: string | null;
  raw_item_name: string;
  product_name: string | null;
  brand: string | null;
  sku: string | null;
  barcode: string | null;
  product_url: string | null;
  image_url: string | null;
  matched_product_confidence: string | null;
  status: string;
  linked_garment_id: string | null;
  created_at: Date;
  total_count?: string;
};

const COLUMNS = `
  id, source_type, source_id, retailer, order_number, purchase_date,
  purchase_price::text as purchase_price, currency,
  raw_item_name, product_name, brand, sku, barcode, product_url, image_url,
  matched_product_confidence::text as matched_product_confidence,
  status, linked_garment_id, created_at
`;

export class PurchaseRepository {
  constructor(private readonly db: Queryable) {}

  async list(
    scope: UserScope,
    filters: { status?: string[]; retailer?: string[]; limit: number },
  ): Promise<CandidateRow[]> {
    const values: unknown[] = [scope.userId];
    const clauses: string[] = ['user_id = $1'];
    let i = 2;

    if (filters.status?.length) {
      clauses.push(`status = any($${i}::text[])`);
      values.push(filters.status);
      i += 1;
    }
    if (filters.retailer?.length) {
      clauses.push(`retailer = any($${i}::text[])`);
      values.push(filters.retailer);
      i += 1;
    }
    values.push(filters.limit);

    const { rows } = await scopedQuery<CandidateRow>(
      this.db,
      scope,
      `select ${COLUMNS}, count(*) over () as total_count
         from purchase_candidates
        where ${clauses.join(' and ')}
        order by purchase_date desc nulls last, created_at desc
        limit $${i}`,
      values,
    );
    return rows;
  }

  async findById(scope: UserScope, id: string): Promise<CandidateRow | null> {
    const { rows } = await scopedQuery<CandidateRow>(
      this.db,
      scope,
      `select ${COLUMNS} from purchase_candidates where user_id = $1 and id = $2`,
      [scope.userId, id],
    );
    return rows[0] ?? null;
  }

  /** Counts by retailer and status, for the discovery screen's summary. */
  async summary(scope: UserScope) {
    const { rows } = await scopedQuery<{ retailer: string | null; status: string; count: string }>(
      this.db,
      scope,
      `select retailer, status, count(*) as count
         from purchase_candidates where user_id = $1
        group by retailer, status`,
      [scope.userId],
    );
    return rows.map((r) => ({
      retailer: r.retailer,
      status: r.status,
      count: Number(r.count),
    }));
  }

  /**
   * Record candidates from a scan.
   *
   * `on conflict do nothing` against the source-unique index is what makes a
   * re-scan idempotent (database-schema.md): the same line of the same order,
   * seen twice, is one candidate. Returns only the rows actually inserted, so
   * a caller can notify about new purchases without notifying twice.
   */
  async insertMany(
    scope: UserScope,
    candidates: {
      sourceType: string;
      sourceId: string;
      rawItemName: string;
      productName: string | null;
      brand: string | null;
      retailer: string | null;
      orderNumber: string | null;
      purchaseDate: string | null;
      purchasePrice: number | null;
      currency: string | null;
      matchConfidence: number | null;
    }[],
  ): Promise<CandidateRow[]> {
    if (candidates.length === 0) return [];

    const inserted: CandidateRow[] = [];
    for (const c of candidates) {
      const { rows } = await scopedQuery<CandidateRow>(
        this.db,
        scope,
        `insert into purchase_candidates
           (user_id, source_type, source_id, raw_item_name, product_name, brand,
            retailer, order_number, purchase_date, purchase_price, currency,
            matched_product_confidence)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         on conflict (user_id, source_type, source_id, raw_item_name) do nothing
         returning ${COLUMNS}`,
        [
          scope.userId,
          c.sourceType,
          c.sourceId,
          c.rawItemName,
          c.productName,
          c.brand,
          c.retailer,
          c.orderNumber,
          c.purchaseDate,
          c.purchasePrice,
          c.currency,
          c.matchConfidence,
        ],
      );
      if (rows[0]) inserted.push(rows[0]);
    }
    return inserted;
  }

  async setStatus(
    scope: UserScope,
    id: string,
    status: string,
    linkedGarmentId: string | null,
  ): Promise<CandidateRow | null> {
    const { rows } = await scopedQuery<CandidateRow>(
      this.db,
      scope,
      `update purchase_candidates
          set status = $3, linked_garment_id = $4, updated_at = now()
        where user_id = $1 and id = $2
        returning ${COLUMNS}`,
      [scope.userId, id, status, linkedGarmentId],
    );
    return rows[0] ?? null;
  }

  /**
   * The purchase fact, kept whether or not a garment survives.
   *
   * `purchase_records.garment_id` is `on delete set null` for the same reason:
   * deleting a garment does not un-happen the purchase.
   */
  async recordPurchase(
    scope: UserScope,
    input: { candidateId: string; garmentId: string | null; candidate: CandidateRow },
  ): Promise<void> {
    await scopedQuery(
      this.db,
      scope,
      `insert into purchase_records
         (user_id, garment_id, candidate_id, retailer, order_number,
          purchase_date, price, currency, source_type)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        scope.userId,
        input.garmentId,
        input.candidateId,
        input.candidate.retailer,
        input.candidate.order_number,
        input.candidate.purchase_date,
        input.candidate.purchase_price,
        input.candidate.currency,
        input.candidate.source_type,
      ],
    );
  }
}
