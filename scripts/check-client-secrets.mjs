#!/usr/bin/env node
/**
 * Fails the build if mobile source references a server-only environment
 * variable.
 *
 * SEC-3: backend secrets must never be exposed to mobile clients. Only
 * `EXPO_PUBLIC_*` variables reach the bundle
 * (`docs/08-engineering/environments.md` — Configuration).
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = join(root, 'apps/mobile');

/** Server-only names, read from .env.example. */
function serverOnlyNames() {
  const example = readFileSync(join(root, '.env.example'), 'utf8');
  return example
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('=')[0]?.trim())
    .filter((name) => Boolean(name) && !name.startsWith('EXPO_PUBLIC_'));
}

function sourceFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.expo', 'dist', 'build', 'ios', 'android'].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|js|jsx|json)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Strip comments and string literals before scanning.
 *
 * Only a real reference can put a value in the bundle. Mira's source cites spec
 * names constantly — a checker that fails on a NAME IN A COMMENT trains people
 * to stop writing comments, or to suppress the check, and then it stops
 * catching the thing it exists for.
 *
 * String literals are stripped too: `"see MIRA_ENV"` in an error message is
 * prose, and an actual read is `process.env.MIRA_ENV`, which survives stripping.
 */
function stripNonCode(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ') // line comments, sparing URLs
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''") // single-quoted strings
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""') // double-quoted strings
    .replace(/`(?:[^`\\]|\\.)*`/g, '``'); // template literals
}

const names = serverOnlyNames();
const files = sourceFiles(MOBILE);
const violations = [];

for (const file of files) {
  const content = stripNonCode(readFileSync(file, 'utf8'));
  for (const name of names) {
    if (new RegExp(`\\b${name}\\b`).test(content)) {
      violations.push(`${file.replace(root + '/', '')}: references server-only ${name}`);
    }
  }
}

if (violations.length > 0) {
  console.error('\nSEC-3 violation — server secrets referenced from mobile source:\n');
  for (const v of violations) console.error(`  ${v}`);
  console.error('\nOnly EXPO_PUBLIC_* variables may reach the mobile bundle.\n');
  process.exit(1);
}

console.log(
  `check-client-secrets: OK (${files.length} mobile files, ${names.length} server-only names)`,
);
