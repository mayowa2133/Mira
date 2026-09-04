/**
 * What the AI Item Review screen shows for each field.
 *
 * `docs/02-design/screen-specs.md` §12 and `ai-product-spec.md` §3:
 *
 *   high      stated, with a tick
 *   medium    stated, no tick, tappable
 *   low       asked as a question
 *   very low  not shown as a value; an empty tappable row
 *
 * Kept free of React so the rules can be tested without a simulator — these
 * decide what the user is told Mira believes, which is worth more scrutiny than
 * how it is laid out.
 */
import type { ConfidenceBand, GarmentAttribute } from './queries';

export type ReviewRow = {
  field: string;
  /** "Brand", "Sleeve length" — sentence case, never snake_case. */
  label: string;
  /** The value as text, or null when there is nothing to state. */
  display: string | null;
  /** How it should read: a claim, a question, or an invitation. */
  tone: 'stated' | 'asked' | 'empty';
  showTick: boolean;
  /** Copy for the row when there is no value to show. */
  placeholder: string;
};

const LABELS: Record<string, string> = {
  category: 'Category',
  subcategory: 'Type',
  brand: 'Brand',
  product_name: 'Name',
  colors: 'Colour',
  pattern: 'Pattern',
  materials: 'Material',
  style: 'Style',
  fit: 'Fit',
  sleeve_length: 'Sleeve length',
  sleeve_type: 'Sleeves',
  neckline: 'Neckline',
  length: 'Length',
  season: 'Season',
  occasion: 'Occasion',
  size: 'Size',
};

/**
 * The order the review screen asks in.
 *
 * Identity first — what is it, who made it, what size — because those are what
 * a person checks. Judgements like season and occasion come last: they are the
 * least certain and the least consequential to get wrong.
 */
export const REVIEW_ORDER = [
  'brand',
  'product_name',
  'category',
  'subcategory',
  'colors',
  'size',
  'materials',
  'pattern',
  'fit',
  'neckline',
  'sleeve_length',
  'length',
  'style',
  'season',
  'occasion',
] as const;

/** Snake_case values are storage, not language. */
function humanize(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function displayValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    const parts = value.filter((v): v is string => typeof v === 'string');
    return parts.length > 0 ? parts.map(humanize).join(', ') : null;
  }
  if (typeof value === 'string') return value.trim().length > 0 ? humanize(value) : null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

/**
 * A question for a field Mira is unsure about.
 *
 * Phrased as a question because §12 says low confidence must read as a prompt,
 * never as a claim — "Is this polyester?" invites an answer; "Polyester" states
 * something Mira does not actually know.
 */
function question(field: string, display: string): string {
  switch (field) {
    case 'brand':
      return `Is this ${display}?`;
    case 'materials':
      return `Is it ${display.toLowerCase()}?`;
    case 'size':
      return `Size ${display}?`;
    default:
      return `${display}?`;
  }
}

const EMPTY_COPY: Record<string, string> = {
  brand: 'Add brand',
  product_name: 'Add name',
  size: 'Add size',
  materials: 'Add material',
  colors: 'Add colour',
};

/**
 * Build the row for one field.
 *
 * A user-sourced value is always stated with a tick regardless of band: the
 * user is not guessing about their own wardrobe, and showing their own answer
 * back as a question would be absurd.
 */
export function toReviewRow(field: string, attribute: GarmentAttribute | undefined): ReviewRow {
  const label = LABELS[field] ?? humanize(field);
  const placeholder = EMPTY_COPY[field] ?? `Add ${label.toLowerCase()}`;

  const display = attribute ? displayValue(attribute.value) : null;
  const band: ConfidenceBand = attribute?.band ?? 'very_low';

  if (display === null) {
    return { field, label, display: null, tone: 'empty', showTick: false, placeholder };
  }

  if (attribute?.source === 'user') {
    return { field, label, display, tone: 'stated', showTick: true, placeholder };
  }

  switch (band) {
    case 'high':
      return { field, label, display, tone: 'stated', showTick: true, placeholder };
    case 'medium':
      // Stated, but without the tick that would make it a claim.
      return { field, label, display, tone: 'stated', showTick: false, placeholder };
    case 'low':
      return {
        field,
        label,
        display: question(field, display),
        tone: 'asked',
        showTick: false,
        placeholder,
      };
    default:
      // Very low: Mira has an opinion but not one worth voicing. The row is
      // empty and tappable — never a form of empty fields (CAP-2), because the
      // fields above it are filled.
      return { field, label, display: null, tone: 'empty', showTick: false, placeholder };
  }
}

export function buildReviewRows(attributes: GarmentAttribute[]): ReviewRow[] {
  const byField = new Map(attributes.map((attribute) => [attribute.field, attribute]));
  return REVIEW_ORDER.map((field) => toReviewRow(field, byField.get(field)));
}

/**
 * The chips shown under the title: the confident, characterful fields.
 *
 * Not every field — a row of fifteen chips is a database dump. These are the
 * ones a person would use to describe the garment to someone else.
 */
export const CHIP_FIELDS = ['subcategory', 'colors', 'occasion', 'style', 'season'] as const;

export function buildChips(attributes: GarmentAttribute[]): string[] {
  const byField = new Map(attributes.map((attribute) => [attribute.field, attribute]));
  const chips: string[] = [];

  for (const field of CHIP_FIELDS) {
    const attribute = byField.get(field);
    if (!attribute) continue;
    // Chips are assertions with no room for doubt, so only confident values
    // earn one.
    if (attribute.source !== 'user' && attribute.band !== 'high' && attribute.band !== 'medium') {
      continue;
    }

    const value = attribute.value;
    const values = Array.isArray(value) ? value : [value];
    for (const entry of values) {
      const text = displayValue(entry);
      if (text && !chips.includes(text)) chips.push(text);
    }
  }

  return chips;
}
