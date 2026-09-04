/**
 * Outfits and wear tracking.
 *
 * The rule that shapes this file is from `api-contract.md` — Wear tracking:
 *
 * > Creating a wear event for an outfit creates one for each of its garments.
 *
 * Without that, "I wore this look" would leave every garment in it still
 * reading as never worn, and the wardrobe insights built on wear data
 * (Phase 9) would be quietly wrong about the clothes the user wears most.
 */
import { conflictsFor, isOutfitSlot, type OutfitSlot } from '@mira/taxonomy';
import { ErrorCode, notFound, validationFailed } from '../../http/errors.js';
import type { UserScope } from '../../db/scope.js';
import type { StorageDriver } from '@mira/storage';
import type { GarmentRepository } from '../closet/repository.js';
import type { OutfitRepository, OutfitRow, OutfitTab } from './repository.js';

export type CreateOutfitRequest = {
  name: string | null;
  occasion: string | null;
  season: string[];
  items: { garment_id: string; slot: string }[];
};

function serializeOutfit(
  row: OutfitRow,
  items: { garment_id: string; slot: string; position: number }[],
) {
  return {
    id: row.id,
    name: row.name,
    occasion: row.occasion,
    season: row.season,
    origin: row.origin,
    favorite: row.favorite,
    items,
    wear: {
      count: row.worn_count,
      last_worn_at: row.last_worn_at?.toISOString() ?? null,
    },
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export class OutfitService {
  constructor(
    private readonly repo: OutfitRepository,
    private readonly garments: GarmentRepository,
    private readonly storage: StorageDriver,
  ) {}

  async list(scope: UserScope, tab: OutfitTab, limit: number) {
    const outfits = await this.repo.list(scope, tab, limit);
    const items = await this.repo.itemsFor(
      scope,
      outfits.map((outfit) => outfit.id),
    );

    const byOutfit = new Map<string, typeof items>();
    for (const item of items) {
      const list = byOutfit.get(item.outfit_id) ?? [];
      list.push(item);
      byOutfit.set(item.outfit_id, list);
    }

    return outfits.map((outfit) =>
      serializeOutfit(
        outfit,
        (byOutfit.get(outfit.id) ?? []).map((item) => ({
          garment_id: item.garment_id,
          slot: item.slot,
          position: item.position,
        })),
      ),
    );
  }

  async get(scope: UserScope, id: string) {
    const outfit = await this.repo.findById(scope, id);
    if (!outfit) throw notFound(ErrorCode.outfitNotFound);

    const items = await this.repo.itemsFor(scope, [id]);

    // Hydrated, so look detail can render each garment as a tappable row with
    // its thumbnail without a second round trip (screen-specs.md §21).
    const garmentIds = items.map((item) => item.garment_id);
    const garments = await this.garments.findByIds(scope, garmentIds);

    const images = await this.garments.imagesFor(scope, garmentIds);
    const imageByGarment = new Map<string, (typeof images)[number]>();
    for (const image of images) {
      if (image.is_canonical || !imageByGarment.has(image.garment_id)) {
        imageByGarment.set(image.garment_id, image);
      }
    }

    const hydrated = await Promise.all(
      items.map(async (item) => {
        const garment = garments.find((row) => row.id === item.garment_id);
        const image = imageByGarment.get(item.garment_id);
        const signed = image
          ? await this.storage.signedReadUrl(image.thumb_key ?? image.storage_key, scope.userId)
          : null;

        return {
          garment_id: item.garment_id,
          slot: item.slot,
          position: item.position,
          name: garment?.name ?? null,
          brand: garment?.brand_raw ?? null,
          category: garment?.category ?? null,
          image_url: signed?.url ?? null,
        };
      }),
    );

    return { ...serializeOutfit(outfit, hydrated), items: hydrated };
  }

  /**
   * Create a look.
   *
   * Slot conflicts are REPORTED, never refused: taxonomy §14 says the user may
   * override the dress/separates rule, and a top over a dress is a real outfit.
   * A product that rejects it is wrong about clothes.
   */
  async create(scope: UserScope, input: CreateOutfitRequest) {
    if (input.items.length === 0) {
      throw validationFailed([{ field: 'items', issue: 'a look needs at least one piece' }]);
    }

    for (const item of input.items) {
      if (!isOutfitSlot(item.slot)) {
        throw validationFailed([{ field: 'items.slot', issue: `unknown slot: ${item.slot}` }]);
      }
    }

    // Every garment must be one the user owns. Anything else is either a stale
    // client or an attempt to reference someone else's closet (SEC-5).
    const requested = input.items.map((item) => item.garment_id);
    const owned = await this.repo.ownedGarmentIds(scope, requested);
    const missing = requested.filter((id) => !owned.has(id));
    if (missing.length > 0) throw notFound(ErrorCode.garmentNotFound);

    const outfit = await this.repo.create(scope, {
      name: input.name,
      occasion: input.occasion,
      season: input.season,
      origin: 'user',
      items: input.items.map((item, index) => ({
        garmentId: item.garment_id,
        slot: item.slot,
        position: index,
      })),
    });

    return this.get(scope, outfit.id);
  }

  /** What is unusual about a set of slots — advice for the builder, not a gate. */
  conflicts(slots: string[]): ReturnType<typeof conflictsFor> {
    const valid = slots.filter(isOutfitSlot);
    const seen: OutfitSlot[] = [];
    const all: ReturnType<typeof conflictsFor> = [];

    for (const slot of valid) {
      all.push(...conflictsFor(seen, slot));
      seen.push(slot);
    }
    return all;
  }

  async setFavorite(scope: UserScope, id: string, favorite: boolean) {
    const row = await this.repo.setFavorite(scope, id, favorite);
    if (!row) throw notFound(ErrorCode.outfitNotFound);
    return this.get(scope, id);
  }

  async remove(scope: UserScope, id: string) {
    const removed = await this.repo.softDelete(scope, id);
    if (!removed) throw notFound(ErrorCode.outfitNotFound);
  }

  /**
   * Record a wear.
   *
   * Wearing a look wears everything in it. The outfit event and the garment
   * events are separate rows so the calendar can show "I wore this look" while
   * each garment's own count stays honest — and deleting the outfit later does
   * not erase the fact that its garments were worn.
   */
  async recordWear(
    scope: UserScope,
    input: { garmentId: string | null; outfitId: string | null; wornOn: string; note: string | null },
  ) {
    if (!input.garmentId && !input.outfitId) {
      throw validationFailed([
        { field: 'garment_id', issue: 'a wear event needs a garment or an outfit' },
      ]);
    }

    if (input.garmentId) {
      const owned = await this.repo.ownedGarmentIds(scope, [input.garmentId]);
      if (!owned.has(input.garmentId)) throw notFound(ErrorCode.garmentNotFound);
    }

    const created: { id: string }[] = [];

    if (input.outfitId) {
      const outfit = await this.repo.findById(scope, input.outfitId);
      if (!outfit) throw notFound(ErrorCode.outfitNotFound);

      created.push(
        await this.repo.recordWear(scope, {
          garmentId: null,
          outfitId: input.outfitId,
          wornOn: input.wornOn,
          note: input.note,
        }),
      );

      const items = await this.repo.itemsFor(scope, [input.outfitId]);
      for (const item of items) {
        created.push(
          await this.repo.recordWear(scope, {
            garmentId: item.garment_id,
            outfitId: input.outfitId,
            wornOn: input.wornOn,
            note: null,
          }),
        );
      }
    } else if (input.garmentId) {
      created.push(
        await this.repo.recordWear(scope, {
          garmentId: input.garmentId,
          outfitId: null,
          wornOn: input.wornOn,
          note: input.note,
        }),
      );
    }

    return { created: created.length, ids: created.map((row) => row.id) };
  }

  async wearEvents(scope: UserScope, range: { from: string | null; to: string | null; limit: number }) {
    return this.repo.wearEvents(scope, range);
  }

  async removeWearEvent(scope: UserScope, id: string) {
    const removed = await this.repo.deleteWearEvent(scope, id);
    if (!removed) throw notFound(ErrorCode.wearEventNotFound);
  }
}
