/**
 * Duplicate detection (`docs/06-ai/duplicate-detection.md`).
 *
 * Pure scoring, with no database and no model behind it, so the same rules run
 * wherever a garment is about to be created — the API's create path today, the
 * worker's photo path once analysis has learned enough to compare (CAP-5).
 *
 * Storing the decision, and merging, belong to whoever owns the rows.
 */
export * from './normalize.js';
export * from './signals.js';
export * from './score.js';
