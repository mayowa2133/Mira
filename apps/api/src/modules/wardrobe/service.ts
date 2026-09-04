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
import type { InsightGarmentRow, WardrobeRepository } from './repository.js';
import {
  closetValue,
  costPerWear,
  headlineFor,
  shouldShow,
  type InsightKind,
} from './rules.js';

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

export class WardrobeService {
  constructor(
    private readonly repo: WardrobeRepository,
    private readonly garments: GarmentRepository,
    private readonly storage: StorageDriver,
  ) {}

  async insights(scope: UserScope, kinds: InsightKind[] = ALL_KINDS): Promise<Insight[]> {
    const closetSize = await this.repo.closetSize(scope);

    const collected: { kind: InsightKind; rows: InsightGarmentRow[] }[] = [];
    for (const kind of kinds) {
      collected.push({ kind, rows: await this.rowsFor(scope, kind) });
    }

    const shown = collected.filter(({ kind, rows }) =>
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

    const value = closetValue(rows.map((row) => (row.purchase_price === null ? null : Number(row.purchase_price))));

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
