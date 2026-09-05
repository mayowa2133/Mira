/**
 * Garment form state and serialization.
 *
 * Deliberately free of React, so the rules that matter — what is required, what
 * is sent, what a cleared field means — are testable without a simulator.
 *
 * Manual entry is the FALLBACK path (`docs/01-product/feature-specs.md` — F-01:
 * manual entry always exists and is always last in the hierarchy). It should
 * therefore ask for as little as possible: only a category is required, and
 * everything else is optional.
 */
import {
  CATEGORY_SUBCATEGORIES,
  isCategory,
  isSubcategoryOf,
  type Category,
  type Subcategory,
} from '@mira/taxonomy';

export type GarmentFormState = {
  category: string | null;
  subcategory: string | null;
  name: string;
  brand: string;
  primaryColor: string | null;
  pattern: string | null;
  materials: string[];
  sizeRaw: string;
  season: string[];
  occasion: string[];
  styleTags: string[];
  retailer: string;
  purchaseDate: string;
  purchasePrice: string;
  currency: string;
  tagsAttached: boolean;
  notes: string;
  /**
   * Carried from a tag scan (task 4.1). Not typed by hand — there is no field
   * for it — but shown on the form so it is visible rather than hidden state,
   * and sent on create because a barcode is a DECISIVE duplicate signal (§2)
   * and what product matching will key on later.
   */
  barcode: string | null;
};

export const EMPTY_FORM: GarmentFormState = {
  barcode: null,
  category: null,
  subcategory: null,
  name: '',
  brand: '',
  primaryColor: null,
  pattern: null,
  materials: [],
  sizeRaw: '',
  season: [],
  occasion: [],
  styleTags: [],
  retailer: '',
  purchaseDate: '',
  purchasePrice: '',
  currency: 'CAD',
  tagsAttached: false,
  notes: '',
};

/** Shape of a garment coming back from the API, for prefilling the edit form. */
export type GarmentLike = {
  category: string;
  subcategory: string | null;
  name: string | null;
  brand: { name: string } | null;
  brand_raw: string | null;
  primary_color: string | null;
  pattern: string | null;
  materials: string[];
  size: { raw: string | null };
  season: string[];
  occasion: string[];
  style_tags: string[];
  purchase: {
    retailer: string | null;
    date: string | null;
    price: { amount: number; currency: string } | null;
  };
  tags_attached: boolean | null;
  notes: string | null;
};

export function formFromGarment(garment: GarmentLike): GarmentFormState {
  return {
    // Editing never carries the barcode: `toUpdatePayload` does not send it,
    // and a value the edit form holds but cannot change is a trap.
    barcode: null,
    category: garment.category,
    subcategory: garment.subcategory,
    name: garment.name ?? '',
    brand: garment.brand?.name ?? garment.brand_raw ?? '',
    primaryColor: garment.primary_color,
    pattern: garment.pattern,
    materials: garment.materials,
    sizeRaw: garment.size.raw ?? '',
    season: garment.season,
    occasion: garment.occasion,
    styleTags: garment.style_tags,
    retailer: garment.purchase.retailer ?? '',
    purchaseDate: garment.purchase.date ?? '',
    purchasePrice: garment.purchase.price ? String(garment.purchase.price.amount) : '',
    currency: garment.purchase.price?.currency ?? 'CAD',
    tagsAttached: garment.tags_attached ?? false,
    notes: garment.notes ?? '',
  };
}

/**
 * Choosing a new category clears a subcategory that no longer belongs to it.
 *
 * A subcategory must belong to its category — `dresses/heels` is invalid
 * (taxonomy §1) — and the server rejects the pair with `subcategory_mismatch`.
 * Clearing it here means the user never sees that error.
 */
export function setCategory(state: GarmentFormState, category: string | null): GarmentFormState {
  const keepSubcategory =
    category !== null &&
    state.subcategory !== null &&
    isCategory(category) &&
    isSubcategoryOf(category, state.subcategory);

  return { ...state, category, subcategory: keepSubcategory ? state.subcategory : null };
}

export function subcategoriesFor(category: string | null): readonly Subcategory[] {
  if (category === null || !isCategory(category)) return [];
  return CATEGORY_SUBCATEGORIES[category as Category];
}

/** Toggle a value in a multi-select field. */
export function toggleIn(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export type FormErrors = Partial<Record<'category' | 'purchasePrice' | 'purchaseDate', string>>;

/**
 * Validate before submitting.
 *
 * Only category is required. Everything else is optional, because the whole
 * point of Mira is not to demand data entry (CAP-2).
 */
export function validateForm(state: GarmentFormState): FormErrors {
  const errors: FormErrors = {};

  if (!state.category) {
    errors.category = 'Pick a category so Mira knows what this is.';
  } else if (!isCategory(state.category)) {
    errors.category = 'That is not a category Mira knows.';
  }

  if (state.purchasePrice.trim()) {
    const price = Number(state.purchasePrice);
    if (!Number.isFinite(price) || price < 0) {
      errors.purchasePrice = 'Enter a price like 79.90.';
    }
  }

  if (state.purchaseDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(state.purchaseDate.trim())) {
    errors.purchaseDate = 'Use YYYY-MM-DD.';
  }

  return errors;
}

export const isValid = (errors: FormErrors): boolean => Object.keys(errors).length === 0;

/** Trim a string field, returning null when it is empty. */
const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export type GarmentPayload = Record<string, unknown>;

/**
 * Serialize for `POST /garments`.
 *
 * `source_type` is `manual`, and the API marks such garments `analysis_state:
 * skipped` — there is nothing for a model to work out when the user has told
 * us directly.
 */
export function toCreatePayload(state: GarmentFormState): GarmentPayload {
  const price = state.purchasePrice.trim() ? Number(state.purchasePrice) : null;

  return {
    category: state.category,
    subcategory: state.subcategory,
    name: orNull(state.name),
    brand_raw: orNull(state.brand),
    primary_color: state.primaryColor,
    pattern: state.pattern,
    materials: state.materials,
    size_raw: orNull(state.sizeRaw),
    // Manual entry has no normalization step yet; the raw value is what the
    // user typed, and size_normalized arrives with the sizing work.
    season: state.season,
    occasion: state.occasion,
    style_tags: state.styleTags,
    retailer: orNull(state.retailer),
    purchase_date: orNull(state.purchaseDate),
    purchase_price: price,
    // The API rejects a price without a currency, so they travel together.
    currency: price === null ? null : state.currency,
    tags_attached: state.tagsAttached ? true : null,
    notes: orNull(state.notes),
    ...(state.barcode ? { barcode: state.barcode } : {}),
    source_type: 'manual',
  };
}

/**
 * Serialize for `PATCH /garments/:id`.
 *
 * Sends only what changed, and NEVER `source_type`: provenance is immutable,
 * and the API rejects it with `immutable_field` (CAP-3).
 */
export function toUpdatePayload(
  original: GarmentFormState,
  current: GarmentFormState,
): GarmentPayload {
  const full = toCreatePayload(current);
  const before = toCreatePayload(original);

  const patch: GarmentPayload = {};
  for (const [key, value] of Object.entries(full)) {
    if (key === 'source_type') continue;
    if (JSON.stringify(value) !== JSON.stringify(before[key])) patch[key] = value;
  }
  return patch;
}

export const hasChanges = (original: GarmentFormState, current: GarmentFormState): boolean =>
  Object.keys(toUpdatePayload(original, current)).length > 0;
