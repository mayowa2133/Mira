/**
 * Stub AI providers for local development and tests.
 *
 * Local development runs against these by default, so the validation, clamping
 * and fallback paths are exercised constantly rather than only in CI
 * (`docs/08-engineering/environments.md` — Local).
 *
 * The stubs deliberately include malformed and out-of-taxonomy responses,
 * because those paths must be as well-trodden as the happy one.
 */
import type {
  AiProviders,
  EmbeddingCapability,
  OcrCapability,
  ReasoningCapability,
  SegmentationCapability,
  TryOnCapability,
  VisionCapability,
} from './capabilities.js';
import {
  GarmentUnderstandingSchema,
  OutfitProposalsSchema,
  QueryInterpretationSchema,
  TagReadingSchema,
} from './contracts.js';
import { parseAndValidate, type Validated } from './pipeline.js';

const EMBEDDING_DIMENSIONS = 1024;

/** Deterministic pseudo-vector, so tests are stable. */
function fakeVector(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => {
    h = Math.imul(h ^ i, 16777619);
    return ((h >>> 0) % 2000) / 1000 - 1;
  });
}

const stubVision: VisionCapability = {
  async analyzeGarment(): Promise<Validated<import('./contracts.js').GarmentUnderstanding>> {
    return parseAndValidate(
      GarmentUnderstandingSchema,
      JSON.stringify({
        category: 'dresses',
        subcategory: 'midi_dress',
        brand: null,
        product_name: null,
        colors: ['black'],
        pattern: 'solid',
        materials: ['polyester'],
        style: ['minimal'],
        fit: 'regular',
        sleeve_length: 'sleeveless',
        sleeve_type: 'none',
        neckline: 'square',
        length: 'midi',
        season: ['spring', 'summer'],
        occasion: ['dinner', 'date'],
        size: null,
        // Brand is null and carries no confidence: never guess a brand (D-014).
        confidence: { category: 0.97, primary_color: 0.95, materials: 0.44 },
      }),
    );
  },
  async readTag(): Promise<Validated<import('./contracts.js').TagReading>> {
    return parseAndValidate(
      TagReadingSchema,
      JSON.stringify({
        matched: false,
        brand: null,
        product_name: null,
        color: null,
        size: null,
        sku: null,
        barcode: null,
        confidence: 0.2,
      }),
    );
  },
};

const stubReasoning: ReasoningCapability = {
  async generateOutfits(input): Promise<Validated<import('./contracts.js').OutfitProposal[]>> {
    // Only ever reference ids from the server-built candidate set (AI-6).
    const first = input.candidates[0];
    const items = first ? [{ slot: 'top', garment_id: first.shortId }] : [];
    return parseAndValidate(
      OutfitProposalsSchema,
      JSON.stringify([
        {
          title: 'Stub look',
          rationale: null,
          items,
          missing_slots: first ? ['bottom', 'shoes'] : ['top', 'bottom', 'shoes'],
        },
      ]),
    );
  },
  async interpretQuery(query): Promise<Validated<import('./contracts.js').QueryInterpretation>> {
    return parseAndValidate(
      QueryInterpretationSchema,
      JSON.stringify({
        filters: {},
        semantic_terms: query.split(/\s+/).filter(Boolean).slice(0, 8),
        sort: null,
        confidence: 0.3,
      }),
    );
  },
};

const stubEmbedding: EmbeddingCapability = {
  async embedImage(image) {
    return fakeVector(image.storageKey);
  },
  async embedText(text) {
    return fakeVector(text);
  },
};

const stubOcr: OcrCapability = {
  async read() {
    return { text: '', confidence: 0 };
  },
};

const stubSegmentation: SegmentationCapability = {
  async cutout() {
    // Returning null exercises the fallback: the ORIGINAL photo becomes the
    // canonical image and the garment is still created
    // (`docs/06-ai/ai-fallbacks.md` — Segmentation).
    return null;
  },
};

const stubTryOn: TryOnCapability = {
  async generate() {
    throw new Error('try-on has no stub provider; it is Phase 10');
  },
};

export const stubProviders: AiProviders = {
  vision: stubVision,
  reasoning: stubReasoning,
  embedding: stubEmbedding,
  ocr: stubOcr,
  segmentation: stubSegmentation,
  tryOn: stubTryOn,
};
