/**
 * Output contracts for every AI capability.
 *
 * AI output is UNTRUSTED INPUT (AI-7). Every response is parsed strictly and
 * validated against these schemas before it can touch the database (AI-2).
 * Malformed output is rejected, never coerced.
 *
 * Contracts follow `docs/06-ai/`.
 */
import { z } from 'zod';
import {
  CATEGORIES,
  COLORS,
  FITS,
  LENGTHS,
  MATERIALS,
  NECKLINES,
  OCCASIONS,
  OUTFIT_SLOTS,
  PATTERNS,
  SEASONS,
  SLEEVE_LENGTHS,
  SLEEVE_TYPES,
  STYLE_TAGS,
  SUBCATEGORIES,
} from '@mira/taxonomy';

const enumOf = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values);

/** Confidence in [0,1] on every machine-generated field (AI-1). */
const confidence = z.record(z.string(), z.number().min(0).max(1));

/**
 * Garment understanding (`docs/06-ai/garment-understanding.md` §1).
 *
 * `brand` is nullable and must NEVER be guessed from style alone — only from a
 * visible logo, a legible label, or a matched product (D-014).
 */
export const GarmentUnderstandingSchema = z.object({
  category: enumOf(CATEGORIES as unknown as [string, ...string[]]),
  subcategory: enumOf(SUBCATEGORIES as unknown as [string, ...string[]]).nullable(),
  brand: z.string().nullable(),
  product_name: z.string().nullable(),
  colors: z.array(enumOf(COLORS as unknown as [string, ...string[]])),
  pattern: enumOf(PATTERNS as unknown as [string, ...string[]]).nullable(),
  materials: z.array(enumOf(MATERIALS as unknown as [string, ...string[]])),
  style: z.array(enumOf(STYLE_TAGS as unknown as [string, ...string[]])),
  fit: enumOf(FITS as unknown as [string, ...string[]]).nullable(),
  sleeve_length: enumOf(SLEEVE_LENGTHS as unknown as [string, ...string[]]).nullable(),
  sleeve_type: enumOf(SLEEVE_TYPES as unknown as [string, ...string[]]).nullable(),
  neckline: enumOf(NECKLINES as unknown as [string, ...string[]]).nullable(),
  length: enumOf(LENGTHS as unknown as [string, ...string[]]).nullable(),
  season: z.array(enumOf(SEASONS as unknown as [string, ...string[]])),
  occasion: z.array(enumOf(OCCASIONS as unknown as [string, ...string[]])),
  size: z.string().nullable(),
  confidence,
});

export type GarmentUnderstanding = z.infer<typeof GarmentUnderstandingSchema>;

/** Tag reading (`docs/06-ai/garment-understanding.md` §3). */
export const TagReadingSchema = z.object({
  matched: z.boolean(),
  brand: z.string().nullable(),
  product_name: z.string().nullable(),
  color: z.string().nullable(),
  size: z.string().nullable(),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type TagReading = z.infer<typeof TagReadingSchema>;

/**
 * Outfit proposal (`docs/06-ai/outfit-recommendation.md` §6).
 *
 * `garment_id` here is the SHORT id from the server-built candidate set. It is
 * resolved and re-validated against that set before anything is returned to the
 * client (AI-6).
 */
export const OutfitProposalSchema = z.object({
  title: z.string().min(1),
  rationale: z.string().nullable(),
  items: z.array(
    z.object({
      slot: enumOf(OUTFIT_SLOTS as unknown as [string, ...string[]]),
      garment_id: z.string().min(1),
    }),
  ),
  missing_slots: z.array(enumOf(OUTFIT_SLOTS as unknown as [string, ...string[]])),
});

export type OutfitProposal = z.infer<typeof OutfitProposalSchema>;
export const OutfitProposalsSchema = z.array(OutfitProposalSchema);

/**
 * Query interpretation (`docs/06-ai/closet-search.md` §2).
 *
 * Unknown descriptive words go to `semantic_terms`, never into `filters` —
 * "cottagecore" is not a style tag, but it is a meaningful retrieval term.
 */
export const QueryInterpretationSchema = z.object({
  filters: z.object({
    category: z.array(z.string()).optional(),
    subcategory: z.array(z.string()).optional(),
    color: z.array(z.string()).optional(),
    season: z.array(z.string()).optional(),
    occasion: z.array(z.string()).optional(),
    brand: z.array(z.string()).optional(),
    never_worn: z.boolean().optional(),
    tags_attached: z.boolean().optional(),
    favorite: z.boolean().optional(),
    not_worn_since_days: z.number().int().positive().optional(),
  }),
  semantic_terms: z.array(z.string()),
  sort: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type QueryInterpretation = z.infer<typeof QueryInterpretationSchema>;
