import type { components } from './api.generated.js';

/** Convenience aliases over the generated OpenAPI schemas. */
export type Garment = components['schemas']['Garment'];
export type GarmentImage = components['schemas']['GarmentImage'];
export type GarmentCreate = components['schemas']['GarmentCreate'];
export type GarmentPage = components['schemas']['GarmentPage'];
export type Outfit = components['schemas']['Outfit'];
export type OutfitProposal = components['schemas']['OutfitProposal'];
export type PurchaseCandidate = components['schemas']['PurchaseCandidate'];
export type BodyProfile = components['schemas']['BodyProfile'];
export type TryOnGeneration = components['schemas']['TryOnGeneration'];
export type WearEvent = components['schemas']['WearEvent'];
export type SearchResult = components['schemas']['SearchResult'];
export type DuplicateCandidate = components['schemas']['DuplicateCandidate'];
export type Session = components['schemas']['Session'];
export type User = components['schemas']['User'];
export type Money = components['schemas']['Money'];
export type ApiError = components['schemas']['Error'];

/**
 * The authenticated actor.
 *
 * V1 has exactly one role: owner. A user can read and write their own data and
 * nothing else (`docs/05-api/auth-contract.md`).
 */
export type Actor = {
  userId: string;
  email: string | null;
};

/** Cursor pagination, used by every list endpoint. */
export type Page<T> = {
  data: T[];
  nextCursor: string | null;
};

export type PageParams = {
  cursor?: string | undefined;
  limit?: number | undefined;
};

export const DEFAULT_PAGE_LIMIT = 40;
export const MAX_PAGE_LIMIT = 100;
