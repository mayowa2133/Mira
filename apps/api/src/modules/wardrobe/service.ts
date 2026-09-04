/**
 * Wardrobe insights (`docs/02-design/screen-specs.md` §26).
 *
 * > Fashion content, not a dashboard. Numbers stay secondary to imagery.
 *
 * So insights return HYDRATED garments with their imagery — the contract says
 * so explicitly — and any insight that cannot be supported by the closet is
 * omitted rather than shown empty. A section reading "0 pieces deserve another
 * chance" is a dashboard cell; leaving it out is editing.
 */
import type { UserScope } from '../../db/scope.js';
import type { StorageDriver } from '@mira/storage';
import type { GarmentRepository } from '../closet/repository.js';
import type { DuplicateRepository, SubjectRow } from '../closet/duplicate-repository.js';
import { findPairs, type DuplicateSubject } from '@mira/duplicates';
import { SAME_IMAGE_MAX_DISTANCE, hammingDistance } from '@mira/imaging';
import type { InsightGarmentRow, WardrobeRepository } from './repository.js';
import { closetValue, costPerWear, headlineFor, shouldShow, type InsightKind } from './rules.js';

const ALL_KINDS: InsightKind[] = ['forgotten', 'never_worn', 'tags_attached', 'most_loved'];

/** Enough to fill a horizontal rail without becoming a list. */
const ITEMS_PER_INSIGHT = 12;

export type InsightGarment = {
  id: string;
  name: string | null;
  brand: string | null;
  category: string;
  image_url: string | null;
  worn_count: number;
  last_worn_at: string | null;
  cost_per_wear: { amount: number; currency: string } | null;
};

export type Insight = {
  kind: InsightKind;
  headline: string;
  /** How many qualify in total; `garments` is the rail's preview of them. */
  total: number;
  garments: InsightGarment[];
};

/** Two pieces the user may not realize are the same thing (§26). */
export type SimilarOwnedPair = {
  a: InsightGarment;
  b: InsightGarment;
  /** In words — "Same brand and a very similar name". Never a score. */
  summary: string;
};

/**
 * Enough to make the point, and few enough to stay a section rather than a
 * list. §26 shows two.
 */
const SIMILAR_PAIRS = 6;

export class WardrobeService {
  constructor(
    private readonly repo: WardrobeRepository,
    private readonly garments: GarmentRepository,
    private readonly storage: StorageDriver,
    private readonly duplicates: DuplicateRepository,
  ) {}

  /**
   * "You might already own this" (`screen-specs.md` §26, task 9.2).
   *
   * The other end of `duplicate-detection.md` §3: everything scoring between
   * 0.50 and 0.699 is saved silently at capture and raised HERE, "in a context
   * where browsing is the point". So this is where the quiet band goes, along
   * with anything stronger that the user has not yet answered.
   *
   * Pairs the user has already ruled on are gone for good — being asked twice
   * about the same two bodysuits is the interruption budget of §1 spent on a
   * question already answered.
   */
  async similarOwned(scope: UserScope): Promise<SimilarOwnedPair[]> {
    // No closet-size gate, unlike every other insight. The others are
    // statistical claims about a wardrobe — "17 pieces deserve another chance"
    // is meaningless at four — and `rules.ts` declines them on a small closet
    // for good reason. This one is a fact about two specific garments, and it
    // is MORE useful early: noticing on the fifth piece that it is the second
    // is exactly when it is worth saying.

    const [rows, hashes, resolved] = await Promise.all([
      this.duplicates.allSubjects(scope),
      this.duplicates.imageHashes(scope),
      this.duplicates.allResolvedPairs(scope),
    ]);

    const pairs = findPairs(
      rows.map((row) => toSubject(row, hashes)),
      { imagePairs: nearIdenticalPairs(hashes) },
    )
      .filter((pair) => !resolved.has(`${pair.a}|${pair.b}`))
      .slice(0, SIMILAR_PAIRS);

    if (pairs.length === 0) return [];

    const ids = [...new Set(pairs.flatMap((pair) => [pair.a, pair.b]))];
    const [garments, urls] = await Promise.all([
      this.repo.insightGarments(scope, ids),
      this.imageUrls(scope, ids),
    ]);

    const byId = new Map(garments.map((row) => [row.id, row]));

    return pairs.flatMap((pair) => {
      const a = byId.get(pair.a);
      const b = byId.get(pair.b);
      // A pair with one side missing is half a question.
      if (!a || !b) return [];
      return [{ a: this.serialize(a, urls), b: this.serialize(b, urls), summary: pair.summary }];
    });
  }

  async insights(scope: UserScope, kinds: InsightKind[] = ALL_KINDS): Promise<Insight[]> {
    const closetSize = await this.repo.closetSize(scope);

    const collected: { kind: InsightKind; rows: InsightGarmentRow[] }[] = [];
    for (const kind of kinds) {
      collected.push({ kind, rows: await this.rowsFor(scope, kind) });
    }

    const shown = collected.filter(
      ({ kind, rows }) =>
        shouldShow(closetSize, {
          kind,
          itemCount: rows.length,
          ...(kind === 'most_loved' ? { topWearCount: rows[0]?.worn_count ?? 0 } : {}),
        }).show,
    );

    // Signed once per garment across every insight: a forgotten piece is often
    // also one that still has its tags.
    const ids = [...new Set(shown.flatMap(({ rows }) => rows.map((row) => row.id)))];
    const urls = await this.imageUrls(scope, ids);

    return shown.map(({ kind, rows }) => {
      // `most_loved` is a single hero image in the spec, not a rail, so there
      // is no "of 175" to report — the qualifying count is every worn garment,
      // which says nothing about the one piece being shown.
      const isHero = kind === 'most_loved';
      const total = isHero ? Math.min(rows.length, 1) : Number(rows[0]?.total_count ?? rows.length);

      return {
        kind,
        // The TOTAL, not the rail length: the rail is a preview.
        headline: headlineFor(kind, total),
        total,
        garments: (isHero ? rows.slice(0, 1) : rows).map((row) => this.serialize(row, urls)),
      };
    });
  }

  private async rowsFor(scope: UserScope, kind: InsightKind): Promise<InsightGarmentRow[]> {
    switch (kind) {
      case 'forgotten':
        return this.repo.forgotten(scope, ITEMS_PER_INSIGHT);
      case 'never_worn':
        return this.repo.neverWorn(scope, ITEMS_PER_INSIGHT);
      case 'tags_attached':
        return this.repo.tagsAttached(scope, ITEMS_PER_INSIGHT);
      case 'most_loved':
        return this.repo.mostLoved(scope, 1);
    }
  }

  private async imageUrls(scope: UserScope, ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();

    const images = await this.garments.imagesFor(scope, ids);
    const best = new Map<string, (typeof images)[number]>();
    for (const image of images) {
      if (image.is_canonical || !best.has(image.garment_id)) best.set(image.garment_id, image);
    }

    const urls = new Map<string, string>();
    await Promise.all(
      [...best.entries()].map(async ([garmentId, image]) => {
        const signed = await this.storage.signedReadUrl(
          image.thumb_key ?? image.storage_key,
          scope.userId,
        );
        urls.set(garmentId, signed.url);
      }),
    );
    return urls;
  }

  private serialize(row: InsightGarmentRow, urls: Map<string, string>): InsightGarment {
    const price = row.purchase_price === null ? null : Number(row.purchase_price);
    const perWear = costPerWear(price, row.worn_count);

    return {
      id: row.id,
      name: row.name,
      brand: row.brand_raw,
      category: row.category,
      image_url: urls.get(row.id) ?? null,
      worn_count: row.worn_count,
      last_worn_at: row.last_worn_at?.toISOString() ?? null,
      cost_per_wear:
        perWear !== null && row.currency ? { amount: perWear, currency: row.currency } : null,
    };
  }

  /**
   * Closet value and cost-per-wear aggregates.
   *
   * Both are optional and collapsed by default on the insights screen (§26):
   * numbers stay secondary to imagery, and a wardrobe is not a balance sheet.
   */
  async stats(scope: UserScope) {
    const rows = await this.repo.priceAndWear(scope);

    const value = closetValue(
      rows.map((row) => (row.purchase_price === null ? null : Number(row.purchase_price))),
    );

    // Averaged over pieces that have actually been worn AND have a price:
    // including unworn pieces would report the wardrobe as more expensive per
    // wear the more recently it was catalogued.
    const perWear: number[] = [];
    for (const row of rows) {
      const price = row.purchase_price === null ? null : Number(row.purchase_price);
      const value = costPerWear(price, row.worn_count);
      if (value !== null) perWear.push(value);
    }

    const currency = rows.find((row) => row.currency)?.currency ?? null;

    return {
      closet_value: {
        total: value.total,
        currency,
        priced_pieces: value.priced,
        // Stated, so the total is read as covering part of the closet rather
        // than all of it.
        unpriced_pieces: value.unpriced,
      },
      cost_per_wear: {
        average:
          perWear.length > 0
            ? Math.round((perWear.reduce((a, b) => a + b, 0) / perWear.length) * 100) / 100
            : null,
        currency,
        based_on_pieces: perWear.length,
      },
    };
  }

  async wearHistory(scope: UserScope, range: { from: string; to: string }) {
    const events = await this.repo.wearHistory(scope, range);

    // Grouped by day, which is how the calendar reads it.
    const byDay = new Map<string, { garment_ids: string[]; outfit_ids: string[] }>();
    for (const event of events) {
      const day = byDay.get(event.worn_on) ?? { garment_ids: [], outfit_ids: [] };
      if (event.garment_id) day.garment_ids.push(event.garment_id);
      if (event.outfit_id && !day.outfit_ids.includes(event.outfit_id)) {
        day.outfit_ids.push(event.outfit_id);
      }
      byDay.set(event.worn_on, day);
    }

    return [...byDay.entries()].map(([worn_on, value]) => ({ worn_on, ...value }));
  }
}

/**
 * A garment row, in the shape the scorer compares.
 *
 * The hashes must come along. `nearIdenticalPairs` only NOMINATES a pair; the
 * score is computed by comparing the two subjects, so a subject with no hashes
 * cannot fire `image_hash` — and a pair found by nothing but its photograph
 * would have been nominated, scored at zero, and dropped.
 */
function toSubject(row: SubjectRow, hashes: Map<string, string[]>): DuplicateSubject {
  return {
    id: row.id,
    name: row.name,
    brandId: row.brand_id,
    brandRaw: row.brand_raw,
    category: row.category,
    primaryColor: row.primary_color,
    sizeNormalized: row.size_normalized,
    sizeRaw: row.size_raw,
    barcode: row.barcode,
    sku: row.sku,
    retailer: row.retailer,
    productUrl: row.product_url,
    purchaseDate: row.purchase_date ? row.purchase_date.toISOString().slice(0, 10) : null,
    sourceType: row.source_type,
    sourceReference: row.source_reference,
    imageHashes: hashes.get(row.id) ?? [],
  };
}

/**
 * Garments photographed near-identically.
 *
 * A hash near-match is not an equality, so it cannot be a bucket key — these
 * pairs are found by comparing hashes directly and handed to `findPairs`
 * alongside the ones it groups itself. Quadratic in images rather than in
 * garments, which for a wardrobe is a far smaller number.
 */
function nearIdenticalPairs(hashes: Map<string, string[]>): [string, string][] {
  const entries = [...hashes.entries()];
  const pairs: [string, string][] = [];

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const [leftId, leftHashes] = entries[i] as [string, string[]];
      const [rightId, rightHashes] = entries[j] as [string, string[]];

      const close = leftHashes.some((left) =>
        rightHashes.some((right) => {
          const distance = hammingDistance(left, right);
          return distance !== null && distance <= SAME_IMAGE_MAX_DISTANCE;
        }),
      );
      if (close) pairs.push([leftId, rightId]);
    }
  }
  return pairs;
}
