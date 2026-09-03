/**
 * Deterministic image operations shared by everything that handles a garment
 * photograph (`docs/06-ai/image-processing.md`).
 *
 * Decoding and resizing belong to the caller — the worker uses `sharp`, the
 * seed encodes its own PNGs — so this package deals only in decoded pixels and
 * stays free of native dependencies.
 */
export * from './pixels.js';
export * from './blurhash.js';
export * from './perceptual-hash.js';
export * from './quality-gate.js';
