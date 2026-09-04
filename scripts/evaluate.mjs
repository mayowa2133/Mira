#!/usr/bin/env node
/**
 * Run an evaluation (`docs/06-ai/evaluation.md`).
 *
 *   npm run evaluate -- --dataset garments
 *
 * Datasets live OUTSIDE the repository — the repo holds manifests and expected
 * labels only, and no production user image enters an evaluation set without
 * explicit, revocable consent. Point MIRA_DATASET_ROOT at a local checkout.
 *
 * The script is deliberately loud about what it could not do. An evaluation
 * that quietly measured nothing and printed a pass is worse than no evaluation
 * at all, because it is believed.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const datasetName = valueOf('--dataset') ?? 'garments';

function valueOf(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

const manifestPath = resolve(repoRoot, 'evaluation', `${datasetName}.manifest.json`);
const datasetRoot = process.env.MIRA_DATASET_ROOT ?? null;

if (!existsSync(manifestPath)) {
  console.error(`No manifest at ${manifestPath}`);
  console.error('Manifests live in evaluation/; datasets live outside the repo.');
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const cases = manifest.cases ?? [];

console.log(`dataset:  ${datasetName}`);
console.log(`manifest: ${manifestPath}`);
console.log(`cases:    ${cases.length}`);
console.log('');

if (!datasetRoot) {
  console.error('MIRA_DATASET_ROOT is not set, so no image can be read.');
  console.error('');
  console.error('The manifest and the metrics are in place; the images are not.');
  console.error('Set MIRA_DATASET_ROOT to a consented dataset checkout and re-run.');
  console.error('');
  console.error('NOT RUN — this is not a pass.');
  process.exit(1);
}

const missing = cases.filter((c) => !existsSync(resolve(datasetRoot, c.image)));
if (missing.length > 0) {
  console.error(`${missing.length} of ${cases.length} images are missing under ${datasetRoot}.`);
  console.error('A partial dataset produces a metric that looks like a result and is not.');
  console.error('');
  console.error('NOT RUN — this is not a pass.');
  process.exit(1);
}

// Wiring a provider is the remaining piece; see tasks/current.md.
console.error('No vision provider is configured, so nothing can be predicted.');
console.error('');
console.error('NOT RUN — this is not a pass.');
process.exit(1);
