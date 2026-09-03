/**
 * @mira/types
 *
 * Shared types for the API contract and the core domain.
 *
 * `api.generated.ts` is generated from `docs/05-api/openapi.yaml` — the machine
 * source of truth for API shapes. Never hand-edit it; run
 * `npm run generate:api-types`.
 */
export type { components, operations, paths } from './api.generated.js';
export * from './domain.js';
export * from './result.js';
