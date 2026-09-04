/**
 * @mira/taxonomy
 *
 * The canonical taxonomy, generated from `docs/04-data/taxonomy.md`.
 *
 * Application code READS these values. It never adds to them (INV-1).
 * AI output is clamped to them before persistence (AI-3).
 *
 * To change the taxonomy, follow `docs/04-data/taxonomy.md` §17:
 * edit the document, regenerate, migrate, update prompts, re-run evaluations.
 */
export * from './generated.js';
export * from './clamp.js';
export * from './slots.js';
