#!/usr/bin/env node
/**
 * Report how much of the plan is built, from `tasks/ledger.json`.
 *
 * This exists because the number was previously produced by a script in /tmp.
 * Every "we are 97% done" in this project's history came from a file that was
 * not in the repository, could not be reviewed, disagreed with
 * `tasks/current.md`, and would have vanished with the next reboot.
 *
 * A completion figure that cannot be recomputed by anyone else is a claim, not
 * a measurement.
 *
 * `--check` fails when the ledger and `tasks/current.md` contradict each other,
 * because they did: the Phase 4 table called 4.1, 4.3 and 4.5 "Not started"
 * the day after they were built and committed.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ledger = JSON.parse(readFileSync(resolve(root, 'tasks/ledger.json'), 'utf8'));
const current = readFileSync(resolve(root, 'tasks/current.md'), 'utf8');

const CHECK = process.argv.includes('--check');

const score = (s) => (s === 'done' ? 1 : s === 'partial' ? 0.5 : 0);
const pct = (a, b) => `${((100 * a) / b).toFixed(0)}%`;

const free = ledger.filter((t) => !t.needsProvider);
const freeDone = free.reduce((n, t) => n + score(t.status), 0);
const allDone = ledger.reduce((n, t) => n + score(t.status), 0);

/**
 * Rows in the status tables of `tasks/current.md`, as `| 4.1 | Label | **Done** |`.
 *
 * Only the status word is read. The prose around it is for people.
 */
function statusesInPlan() {
  const found = new Map();
  for (const line of current.split('\n')) {
    const m = /^\|\s*(\d+\.\d+)\s*\|[^|]*\|\s*\*\*([^*]+)\*\*/.exec(line);
    if (!m) continue;
    const word = m[2].trim().toLowerCase();
    const status = word.startsWith('done')
      ? 'done'
      : word.startsWith('not started')
        ? 'todo'
        : 'partial';
    found.set(m[1], status);
  }
  return found;
}

const contradictions = [];
const planned = statusesInPlan();
for (const task of ledger) {
  const claimed = planned.get(task.id);
  if (!claimed) continue;
  // `partial` is a judgement the ledger is allowed to hold on its own; only a
  // flat done/not-started disagreement is a contradiction.
  if (claimed === 'done' && task.status === 'todo') {
    contradictions.push(`${task.id}: current.md says Done, ledger says todo`);
  }
  if (claimed === 'todo' && task.status === 'done') {
    contradictions.push(`${task.id}: current.md says Not started, ledger says done`);
  }
}

if (CHECK) {
  if (contradictions.length > 0) {
    console.error('\n  task-status: tasks/current.md and tasks/ledger.json disagree\n');
    for (const line of contradictions) console.error(`    ${line}`);
    console.error('\n  Fix whichever is wrong. A plan that contradicts itself is not a plan.\n');
    process.exit(1);
  }
  console.log('task-status: the plan and the ledger agree');
  process.exit(0);
}

console.log(`total tasks              ${ledger.length}`);
console.log(`  AI-free                ${free.length}`);
console.log(`  needs a provider       ${ledger.length - free.length}`);
console.log('');
console.log(
  `AI-FREE COMPLETE         ${freeDone} / ${free.length}   ${pct(freeDone, free.length)}`,
);
console.log(
  `whole plan complete      ${allDone} / ${ledger.length}   ${pct(allDone, ledger.length)}`,
);
console.log('');
console.log('AI-free work still open:');
for (const t of free) {
  if (t.status !== 'done')
    console.log(`  ${t.status.padEnd(8)} ${t.id}${t.note ? ` — ${t.note}` : ''}`);
}
