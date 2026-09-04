/**
 * Turning garments into the shape the scorer compares
 * (`docs/06-ai/duplicate-detection.md` §2).
 *
 * Kept apart from the service so the two directions — a row from the closet and
 * a payload that is about to become one — are written next to each other and
 * cannot quietly drift into comparing different fields.
 */
import type { DuplicateSubject } from '@mira/duplicates';
import type { CreateGarmentInput, GarmentRow } from './repository.js';

export function subjectFromRow(row: GarmentRow, imageHashes: readonly string[]): DuplicateSubject {
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
    // `purchase_date` is a DATE, which pg hands back as a Date at local
    // midnight. Comparing those directly across a timezone boundary shifts a
    // purchase by a day, so it is reduced to the calendar date it actually is.
    purchaseDate: row.purchase_date ? toIsoDate(row.purchase_date) : null,
    sourceType: row.source_type,
    sourceReference: row.source_reference,
    imageHashes,
  };
}

/**
 * A garment that does not exist yet.
 *
 * `brandId` is null even when the brand is recognizable: brand resolution runs
 * after creation, so at this point the only brand Mira has is the raw text the
 * user or the model supplied. The scorer falls back to comparing that
 * (`sameBrand`), which is why an unresolved brand still matches a resolved one
 * on the same spelling.
 */
export function subjectFromInput(
  input: Omit<CreateGarmentInput, 'closetId'>,
  imageHashes: readonly string[] = [],
): DuplicateSubject {
  return {
    name: input.name,
    brandId: null,
    brandRaw: input.brandRaw,
    category: input.category,
    primaryColor: input.primaryColor,
    sizeNormalized: input.sizeNormalized,
    sizeRaw: input.sizeRaw,
    barcode: input.barcode,
    sku: input.sku,
    retailer: input.retailer,
    productUrl: input.productUrl,
    purchaseDate: input.purchaseDate,
    sourceType: input.sourceType,
    sourceReference: input.sourceReference,
    imageHashes,
  };
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
