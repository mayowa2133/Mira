/**
 * AI capability interfaces.
 *
 * Services depend on CAPABILITIES, never on a provider SDK
 * (ADR 0002, `docs/03-architecture/ai-architecture.md` §2).
 * Each capability's provider and model are independently configured, so one can
 * be swapped, A/B tested or rolled back without touching the others.
 *
 * Phase 0 defines the interfaces and a stub provider. Real providers arrive in
 * Phase 3 (`docs/08-engineering/implementation-plan.md`).
 */
import type {
  GarmentUnderstanding,
  OutfitProposal,
  QueryInterpretation,
  TagReading,
} from './contracts.js';
import type { Validated } from './pipeline.js';

export type ImageRef = {
  /** Storage key in a private bucket. Never a public URL. */
  storageKey: string;
  /** Perceptual hash, used for caching and duplicate detection. */
  imageHash?: string | undefined;
};

export type GarmentAnalysisInput = {
  images: ImageRef[];
  /** OCR text from a tag, if one was scanned. UNTRUSTED — delimited as data. */
  tagText?: string | undefined;
};

export type TagInput = {
  image: ImageRef;
  barcode?: string | undefined;
};

/**
 * A garment the model is allowed to reference, with a short stable id.
 *
 * The stylist selects from this server-built candidate set and its output is
 * validated against it. This is what makes "no hallucinated garments" an
 * enforced invariant rather than a prompt request (AI-6).
 */
export type OutfitCandidate = {
  shortId: string;
  garmentId: string;
  category: string;
  subcategory: string | null;
  primaryColor: string | null;
  brand: string | null;
  name: string | null;
};

export type OutfitRequest = {
  prompt: string | null;
  vibe: string[];
  priority: string | null;
  candidates: OutfitCandidate[];
  count: number;
};

export interface VisionCapability {
  analyzeGarment(input: GarmentAnalysisInput): Promise<Validated<GarmentUnderstanding>>;
  readTag(input: TagInput): Promise<Validated<TagReading>>;
}

export interface ReasoningCapability {
  generateOutfits(input: OutfitRequest): Promise<Validated<OutfitProposal[]>>;
  interpretQuery(query: string): Promise<Validated<QueryInterpretation>>;
}

export interface EmbeddingCapability {
  embedImage(image: ImageRef): Promise<number[]>;
  embedText(text: string): Promise<number[]>;
}

export interface OcrCapability {
  read(image: ImageRef): Promise<{ text: string; confidence: number }>;
}

export interface SegmentationCapability {
  cutout(image: ImageRef): Promise<{ storageKey: string; maskCoverage: number } | null>;
}

export interface TryOnCapability {
  generate(input: {
    bodyImages: ImageRef[];
    garmentImages: ImageRef[];
    garmentMetadata: Record<string, unknown>;
  }): Promise<{ storageKey: string }>;
}

/** The set of capabilities the application resolves at startup. */
export interface AiProviders {
  vision: VisionCapability;
  reasoning: ReasoningCapability;
  embedding: EmbeddingCapability;
  ocr: OcrCapability;
  segmentation: SegmentationCapability;
  tryOn: TryOnCapability;
}
