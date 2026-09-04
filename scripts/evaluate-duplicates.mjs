#!/usr/bin/env node
/**
 * Duplicate detection evaluation (`docs/06-ai/duplicate-detection.md` §7).
 *
 *   npm run evaluate:duplicates
 *
 * WHAT THIS MEASURES, AND WHAT IT DOES NOT
 *
 * The dataset is synthetic and authored alongside the scorer, so it is partly
 * circular: it cannot tell you how Mira behaves on real wardrobes, and a good
 * number here is not evidence of real-world accuracy. What it does do is make
 * the thresholds falsifiable, force the hard cases to be written down, and
 * fail loudly when a change moves a boundary — which is the difference between
 * a threshold that was chosen and one that is merely inherited.
 *
 * Read the family breakdown, not just the headline. A metric that passes while
 * one family fails completely is hiding the thing worth knowing.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ASK_SOFTLY_THRESHOLD,
  ASK_THRESHOLD,
  NOTE_THRESHOLD,
  compare,
} from '../packages/duplicates/dist/index.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const datasetPath = resolve(repoRoot, 'evaluation/duplicates.dataset.json');
const dataset = JSON.parse(readFileSync(datasetPath, 'utf8'));

const subject = (base, side, id) => ({
  id,
  ...dataset.defaults,
  ...(base ?? {}),
  ...(side ?? {}),
});

const results = dataset.cases.map((c) => {
  const match = compare(subject(c.base, c.a, `${c.id}-a`), subject(c.base, c.b, `${c.id}-b`));
  return { ...c, ...match };
});

const duplicates = results.filter((r) => r.label === 'duplicate');
const different = results.filter((r) => r.label === 'different');

/**
 * §3's bands. `ask` and `ask_softly` both stop the save and ask; `note` and
 * `ignore` do not. Precision and recall are quoted at the two thresholds the
 * spec names, so they are computed from the score, not from the band name.
 */
const atLeast = (r, t) => r.score >= t;

const predictedAsk = results.filter((r) => atLeast(r, ASK_THRESHOLD));
const truePositivesAsk = predictedAsk.filter((r) => r.label === 'duplicate');
const precisionAtAsk =
  predictedAsk.length === 0 ? null : truePositivesAsk.length / predictedAsk.length;

const recalledSoftly = duplicates.filter((r) => atLeast(r, ASK_SOFTLY_THRESHOLD));
const recallAtSoftly = recalledSoftly.length / duplicates.length;

// A false duplicate is an interruption about two garments that are not the
// same — the failure §1 says may lead someone to merge things they own
// separately.
const falseDuplicates = different.filter((r) => atLeast(r, ASK_SOFTLY_THRESHOLD));
const falseDuplicateRate = falseDuplicates.length / different.length;

// Secondary, and not one of §7's numbers: how many true duplicates Mira
// NOTICED at all. §3 routes the 0.50-0.699 band to "you might already own
// this" rather than to a sheet, so a pair counted as missed above may still
// reach the user while they browse. Reported because the difference between
// "never seen" and "raised somewhere quieter" is the difference between a bug
// and a design decision.
const noticed = duplicates.filter((r) => atLeast(r, NOTE_THRESHOLD));
const recallAtNote = noticed.length / duplicates.length;

const targets = [
  { name: 'Precision @0.90', value: precisionAtAsk, target: 0.95, direction: 'min' },
  { name: 'Recall @0.70', value: recallAtSoftly, target: 0.9, direction: 'min' },
  { name: 'False-duplicate rate', value: falseDuplicateRate, target: 0.05, direction: 'max' },
];

const pct = (v) => (v === null ? '   n/a' : `${(v * 100).toFixed(1)}%`);
const ok = (t) =>
  t.value === null ? false : t.direction === 'min' ? t.value >= t.target : t.value <= t.target;

console.log(`dataset:  ${dataset.dataset} v${dataset.version} (${dataset.provenance})`);
console.log(`pairs:    ${duplicates.length} duplicate · ${different.length} different`);
console.log('');

for (const t of targets) {
  const bar = t.direction === 'min' ? `≥ ${pct(t.target)}` : `≤ ${pct(t.target)}`;
  console.log(
    `${ok(t) ? 'PASS' : 'FAIL'}  ${t.name.padEnd(22)} ${pct(t.value).padStart(6)}  (${bar})`,
  );
}

console.log('');
console.log(
  `      ${'Noticed at all (≥0.50)'.padEnd(22)} ${pct(recallAtNote).padStart(6)}  (secondary, not a §7 target)`,
);

console.log('');
console.log('By family — where a headline number is coming from:');
const families = [...new Set(results.map((r) => r.family))];
for (const family of families.sort()) {
  const rows = results.filter((r) => r.family === family);
  const label = rows[0].label;
  const wrong = rows.filter((r) =>
    label === 'duplicate' ? !atLeast(r, ASK_SOFTLY_THRESHOLD) : atLeast(r, ASK_SOFTLY_THRESHOLD),
  );
  const verdict = wrong.length === 0 ? '     ' : ` ${String(wrong.length).padStart(2)} wrong`;
  console.log(
    `  ${label === 'duplicate' ? 'dup ' : 'diff'} ${family.padEnd(28)} ${String(rows.length).padStart(2)} pairs${verdict}`,
  );
}

const misses = duplicates.filter((r) => !atLeast(r, ASK_SOFTLY_THRESHOLD));
if (misses.length > 0) {
  console.log('');
  console.log(`Missed duplicates (${misses.length}) — scored below 0.70, so never asked about:`);
  for (const m of misses) {
    console.log(`  ${m.score.toFixed(3)}  ${m.id}`);
    console.log(`         ${m.why}`);
  }
}

if (falseDuplicates.length > 0) {
  console.log('');
  console.log(
    `False duplicates (${falseDuplicates.length}) — asked about two garments that are not the same:`,
  );
  for (const f of falseDuplicates) {
    console.log(`  ${f.score.toFixed(3)}  ${f.id}  [${f.signals.join(', ')}]`);
    console.log(`         ${f.why}`);
  }
}

console.log('');
console.log('This dataset is synthetic and was authored alongside the scorer.');
console.log('It measures internal consistency and guards regressions. It is NOT');
console.log('evidence of accuracy on real wardrobes.');

process.exit(targets.every(ok) ? 0 : 1);
