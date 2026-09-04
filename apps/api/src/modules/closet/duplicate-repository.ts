/**
 * Reads and writes for duplicate detection
 * (`docs/06-ai/duplicate-detection.md`).
 *
 * Every statement is scoped to one user. §6 is explicit that duplicate
 * detection is per user — two people owning the same dress is not a duplicate —
 * and a query here that crossed the boundary would leak one closet into
 * another's sheet (SEC-5).
 */
import type { Queryable } from '../../db/pool.js';
import { scopedQuery, type UserScope } from '../../db/scope.js';
import type { DuplicateSubject } from '@mira/duplicates';
import { GARMENT_COLUMNS, type GarmentRow } from './repository.js';

/**
 * The most garments one check will score.
 *
 * Scoring is a few string comparisons per candidate, so this is generous rather
 * than tight — but it is a bound, because the retrieval predicate is deliberately
 * broad and a closet where every piece shares a brand would otherwise be scored
 * end to end on every capture. Phase 5's embeddings and an ANN index are the
 * real answer to a closet large enough for this to matter.
 */
const MAX_CANDIDATES = 2000;

export type ResolvedPair = { garmentId: string; relation: string };

/** The columns a comparison needs, and nothing else. */
export type SubjectRow = {
  id: string;
  name: string | null;
  brand_id: string | null;
  brand_raw: string | null;
  category: string;
  primary_color: string | null;
  size_normalized: string | null;
  size_raw: string | null;
  barcode: string | null;
  sku: string | null;
  retailer: string | null;
  product_url: string | null;
  purchase_date: Date | null;
  source_type: string;
  source_reference: string | null;
};

export class DuplicateRepository {
  constructor(private readonly db: Queryable) {}

  /**
   * Every garment that could possibly fire a signal against this subject.
   *
   * The predicate is an OR of "has the kind of thing that could match", not of
   * "matches" — because the matching itself is normalization the database
   * cannot do: a barcode transcribed with spaces, a product URL carrying a
   * tracking parameter, a name one word longer than the other. Retrieving on
   * exact equality would silently lose exactly the near-matches the whole
   * feature exists to catch.
   *
   * Each clause self-disables when the subject has nothing to compare, so a
   * manual entry with only a category retrieves brand matches and nothing else.
   *
   * Nothing here covers `purchase_window` alone, which is deliberate: a weak
   * signal on its own scores below every band that surfaces anything, so a
   * garment retrievable by nothing else could not be shown to the user even if
   * it were found.
   */
  async candidates(
    scope: UserScope,
    subject: DuplicateSubject,
    imageMatchIds: readonly string[],
  ): Promise<GarmentRow[]> {
    const { rows } = await scopedQuery<GarmentRow>(
      this.db,
      scope,
      `select ${GARMENT_COLUMNS}
         from garments g
         left join brands b on b.id = g.brand_id
        where g.user_id = $1
          and g.deleted_at is null
          and ($2::uuid is null or g.id <> $2::uuid)
          and (
                ($3::boolean and g.barcode is not null)
             or ($4::boolean and g.sku is not null)
             or ($5::boolean and g.product_url is not null)
             or ($6::boolean and g.source_reference is not null and g.source_type = $7)
             or ($8::uuid is not null and g.brand_id = $8::uuid)
             or ($9::text is not null and lower(g.brand_raw) = lower($9))
             or (g.id = any($10::uuid[]))
          )
        order by g.created_at desc
        limit ${MAX_CANDIDATES}`,
      [
        scope.userId,
        subject.id ?? null,
        subject.barcode !== null,
        subject.sku !== null,
        subject.productUrl !== null,
        subject.sourceReference !== null,
        subject.sourceType,
        subject.brandId,
        subject.brandRaw,
        [...imageMatchIds],
      ],
    );
    return rows;
  }

  /**
   * The whole closet, in comparable form.
   *
   * For the surface that looks for pairs the user already owns (§26) rather
   * than for one garment arriving. Deliberately narrow columns: this reads
   * every row, and the imagery is fetched later for the handful that match.
   */
  async allSubjects(scope: UserScope): Promise<SubjectRow[]> {
    const { rows } = await scopedQuery<SubjectRow>(
      this.db,
      scope,
      `select id, name, brand_id, brand_raw, category, primary_color,
              size_normalized, size_raw, barcode, sku, retailer, product_url,
              purchase_date, source_type, source_reference
         from garments
        where user_id = $1 and deleted_at is null and status <> 'archived'`,
      [scope.userId],
    );
    return rows;
  }

  /**
   * Every pair this user has ruled on, as `a|b` keys.
   *
   * Including `same_item`, which should never appear — one of the two garments
   * no longer exists — but costs nothing to exclude and would be a confusing
   * thing to show if it ever did.
   */
  async allResolvedPairs(scope: UserScope): Promise<Set<string>> {
    const { rows } = await scopedQuery<{ garment_a_id: string; garment_b_id: string }>(
      this.db,
      scope,
      `select garment_a_id, garment_b_id from garment_duplicates where user_id = $1`,
      [scope.userId],
    );
    return new Set(rows.map((row) => `${row.garment_a_id}|${row.garment_b_id}`));
  }

  /** Perceptual hashes across the user's closet, by garment. */
  async imageHashes(scope: UserScope): Promise<Map<string, string[]>> {
    const { rows } = await scopedQuery<{ garment_id: string; image_hash: string }>(
      this.db,
      scope,
      `select garment_id, image_hash
         from garment_images
        where user_id = $1 and image_hash is not null and deleted_at is null`,
      [scope.userId],
    );

    const byGarment = new Map<string, string[]>();
    for (const row of rows) {
      const list = byGarment.get(row.garment_id) ?? [];
      list.push(row.image_hash);
      byGarment.set(row.garment_id, list);
    }
    return byGarment;
  }

  /**
   * Pairs this user has already ruled on.
   *
   * Mira asks once. Someone who has said "I own two" about a pair of identical
   * bodysuits should not be asked again every time either one is edited or
   * re-analyzed — that is the interruption budget of §1 spent on a question
   * already answered.
   */
  async resolvedAgainst(scope: UserScope, garmentId: string): Promise<ResolvedPair[]> {
    const { rows } = await scopedQuery<{ other_id: string; relation: string }>(
      this.db,
      scope,
      `select case when garment_a_id = $2 then garment_b_id else garment_a_id end as other_id,
              relation
         from garment_duplicates
        where user_id = $1 and (garment_a_id = $2 or garment_b_id = $2)`,
      [scope.userId, garmentId],
    );
    return rows.map((row) => ({ garmentId: row.other_id, relation: row.relation }));
  }

  /**
   * Record a decision, including a negative one.
   *
   * `different` rows are as valuable as `same_item` ones: §7 measures precision
   * against them, and without them a false-duplicate rate cannot be computed at
   * all. So this is called on every branch of the sheet, not only the merging one.
   *
   * The pair is written in the canonical order the table's check constraint
   * requires, so arriving from either direction stores one row.
   */
  async record(
    scope: UserScope,
    input: {
      garmentA: string;
      garmentB: string;
      relation: 'same_item' | 'owns_two' | 'different';
      score: number | null;
      resolvedBy: 'user' | 'system';
    },
  ): Promise<void> {
    const [a, b] =
      input.garmentA < input.garmentB
        ? [input.garmentA, input.garmentB]
        : [input.garmentB, input.garmentA];

    await scopedQuery(
      this.db,
      scope,
      `insert into garment_duplicates
         (user_id, garment_a_id, garment_b_id, relation, detector_score, resolved_by)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (garment_a_id, garment_b_id) do update
         set relation = excluded.relation,
             detector_score = excluded.detector_score,
             resolved_by = excluded.resolved_by`,
      [scope.userId, a, b, input.relation, input.score, input.resolvedBy],
    );
  }
}
