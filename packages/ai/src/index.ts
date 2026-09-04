/**
 * @mira/ai
 *
 * Provider-independent AI layer (ADR 0002).
 *
 * Services depend on the capability interfaces here, never on a provider SDK.
 * Every response passes through the validation pipeline before it can touch the
 * database: parse -> schema -> taxonomy clamp -> confidence normalization.
 */
export * from './capabilities.js';
export * from './contracts.js';
export * from './pipeline.js';
export { stubProviders } from './stub-provider.js';
export * from './clamp.js';
