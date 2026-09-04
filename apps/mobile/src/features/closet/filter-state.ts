/**
 * Closet filter state.
 *
 * React-free, so the rules are testable without a simulator:
 * what an applied filter looks like, how filters become query params, and what
 * the dismissible chips above the grid should say.
 *
 * Filters combine with AND; array values OR within their own field (INV-3).
 */
import { COLOR_SWATCHES, type Color } from '@mira/taxonomy';
import type { ClosetFilters } from './queries';

export type FilterState = {
  category: string[];
  color: string[];
  season: string[];
  occasion: string[];
  /** Brand IDs, not names: an unresolved brand cannot be filtered on. */
  brandId: string[];
  size: string[];
  /** Both optional and independent — "under £50" is a real thing to ask. */
  priceMin: number | null;
  priceMax: number | null;
  /** Status-shaped toggles, which map onto several different query params. */
  neverWorn: boolean;
  tagsAttached: boolean;
  recentlyAdded: boolean;
  favorite: boolean;
  laundry: boolean;
};

/**
 * What "Recently Added" means (§16).
 *
 * A window the server evaluates, not a date the client computes — a client
 * clock a day out would silently include or exclude a piece on the boundary.
 */
export const RECENTLY_ADDED_DAYS = 30;

export const EMPTY_FILTERS: FilterState = {
  category: [],
  color: [],
  season: [],
  occasion: [],
  brandId: [],
  size: [],
  priceMin: null,
  priceMax: null,
  neverWorn: false,
  tagsAttached: false,
  recentlyAdded: false,
  favorite: false,
  laundry: false,
};

export function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export const isEmpty = (state: FilterState): boolean =>
  state.category.length === 0 &&
  state.color.length === 0 &&
  state.season.length === 0 &&
  state.occasion.length === 0 &&
  state.brandId.length === 0 &&
  state.size.length === 0 &&
  state.priceMin === null &&
  state.priceMax === null &&
  !state.neverWorn &&
  !state.tagsAttached &&
  !state.recentlyAdded &&
  !state.favorite &&
  !state.laundry;

export function countActive(state: FilterState): number {
  return (
    state.category.length +
    state.color.length +
    state.season.length +
    state.occasion.length +
    state.brandId.length +
    state.size.length +
    // A range is one filter however many ends it has.
    (state.priceMin !== null || state.priceMax !== null ? 1 : 0) +
    (state.neverWorn ? 1 : 0) +
    (state.tagsAttached ? 1 : 0) +
    (state.recentlyAdded ? 1 : 0) +
    (state.favorite ? 1 : 0) +
    (state.laundry ? 1 : 0)
  );
}

/**
 * Convert to query parameters.
 *
 * Empty arrays and false booleans are omitted entirely: sending
 * `favorite=false` would filter to NON-favourites, which is not what an
 * un-ticked box means.
 */
export function toQueryFilters(state: FilterState): ClosetFilters {
  const filters: ClosetFilters = {};

  if (state.category.length) filters.category = state.category;
  if (state.color.length) filters.color = state.color;
  if (state.season.length) filters.season = state.season;
  if (state.occasion.length) filters.occasion = state.occasion;
  if (state.brandId.length) filters.brand_id = state.brandId;
  if (state.size.length) filters.size = state.size;
  if (state.priceMin !== null) filters.price_min = state.priceMin;
  if (state.priceMax !== null) filters.price_max = state.priceMax;
  if (state.recentlyAdded) filters.added_within_days = RECENTLY_ADDED_DAYS;
  if (state.neverWorn) filters.never_worn = true;
  if (state.tagsAttached) filters.tags_attached = true;
  if (state.favorite) filters.favorite = true;
  // "Laundry" asks for a status the closet hides by default, so it must be
  // requested explicitly rather than added to the default set.
  if (state.laundry) filters.status = ['laundry'];

  return filters;
}

export type AppliedChip = {
  /** Stable key for React, and for the removal handler. */
  key: string;
  label: string;
  remove: (state: FilterState) => FilterState;
};

const titleCase = (value: string): string =>
  value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/**
 * The dismissible chips shown above the grid.
 *
 * Applied filters stay visible while browsing, and each is removable in one tap
 * (`docs/02-design/screen-specs.md` §14, Reference 03).
 */
export function appliedChips(
  state: FilterState,
  /**
   * Brand ids are what the filter carries; names are what a chip must say.
   * Passed in rather than looked up here so this stays free of the query layer
   * — and a brand whose name has not loaded is skipped rather than shown as a
   * uuid, which would be worse than showing nothing.
   */
  brandNames: Map<string, string> = new Map(),
): AppliedChip[] {
  const chips: AppliedChip[] = [];

  const forList = (field: 'category' | 'color' | 'season' | 'occasion', values: string[]): void => {
    for (const value of values) {
      chips.push({
        key: `${field}:${value}`,
        label: titleCase(value),
        remove: (s) => ({ ...s, [field]: s[field].filter((v) => v !== value) }),
      });
    }
  };

  forList('category', state.category);
  forList('color', state.color);
  forList('season', state.season);
  forList('occasion', state.occasion);

  for (const id of state.brandId) {
    const name = brandNames.get(id);
    if (!name) continue;
    chips.push({
      key: `brand:${id}`,
      label: name,
      remove: (s) => ({ ...s, brandId: s.brandId.filter((v) => v !== id) }),
    });
  }

  for (const size of state.size) {
    chips.push({
      key: `size:${size}`,
      label: `Size ${size}`,
      remove: (s) => ({ ...s, size: s.size.filter((v) => v !== size) }),
    });
  }

  if (state.priceMin !== null || state.priceMax !== null) {
    chips.push({
      key: 'price',
      label: priceLabel(state.priceMin, state.priceMax),
      remove: (s) => ({ ...s, priceMin: null, priceMax: null }),
    });
  }

  if (state.recentlyAdded) {
    chips.push({
      key: 'recentlyAdded',
      label: 'Recently added',
      remove: (s) => ({ ...s, recentlyAdded: false }),
    });
  }

  if (state.neverWorn) {
    chips.push({
      key: 'neverWorn',
      label: 'Never worn',
      remove: (s) => ({ ...s, neverWorn: false }),
    });
  }
  if (state.tagsAttached) {
    chips.push({
      key: 'tagsAttached',
      label: 'Still has tags',
      remove: (s) => ({ ...s, tagsAttached: false }),
    });
  }
  if (state.favorite) {
    chips.push({ key: 'favorite', label: 'Favourite', remove: (s) => ({ ...s, favorite: false }) });
  }
  if (state.laundry) {
    chips.push({
      key: 'laundry',
      label: 'In the laundry',
      remove: (s) => ({ ...s, laundry: false }),
    });
  }

  return chips;
}

/**
 * Colours offered in the filter sheet, as true swatches.
 *
 * Every swatch carries its NAME as well as its colour: colour must never be the
 * only carrier of meaning (A11Y-4, `docs/02-design/accessibility.md` §5).
 * `multicolor` has no single swatch, so it is offered as a labelled option.
 */
export type ColorOption = { value: Color; label: string; swatch: string | null };

export function colorOptions(): ColorOption[] {
  return (Object.keys(COLOR_SWATCHES) as Color[]).map((value) => ({
    value,
    label: titleCase(value),
    swatch: COLOR_SWATCHES[value],
  }));
}

/** Formats the sticky CTA. Never "Show 1 items". */
export function ctaLabel(count: number | undefined): string {
  if (count === undefined) return 'Show items';
  if (count === 0) return 'No pieces match';
  return `Show ${count} ${count === 1 ? 'piece' : 'pieces'}`;
}

/**
 * A price range, said the way a person would.
 *
 * "Under 50" and "Over 50" rather than "0–50" and "50–∞": a range with one end
 * open is a different thought from a range with two.
 */
export function priceLabel(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${min}–${max}`;
  if (max !== null) return `Under ${max}`;
  return `Over ${min}`;
}
