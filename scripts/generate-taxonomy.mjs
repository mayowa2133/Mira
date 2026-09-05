#!/usr/bin/env node
/**
 * Generates packages/taxonomy/src/generated.ts from docs/04-data/taxonomy.md.
 *
 * docs/04-data/taxonomy.md is the SINGLE SOURCE OF TRUTH for every enumerated
 * value in Mira. Application code reads the generated package; it never adds to
 * it (INV-1, AI-3).
 *
 * This script fails loudly if a section is missing or parses to nothing, so a
 * documentation edit that breaks the expected format breaks the build rather
 * than silently emitting an empty enum.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(root, 'docs/04-data/taxonomy.md');
const OUT = resolve(root, 'packages/taxonomy/src/generated.ts');

/**
 * `--check` verifies rather than writes.
 *
 * It used to do neither: the script had no argument handling at all, so
 * `generate:taxonomy:check` regenerated the file, overwrote whatever evidence
 * of drift was there, and exited 0. It was a check that could not fail — which
 * is worse than no check, because the package.json entry made it look covered.
 */
const CHECK = process.argv.includes('--check');

const md = readFileSync(SOURCE, 'utf8');

function fail(msg) {
  console.error(`\n  generate-taxonomy: ${msg}\n  source: ${SOURCE}\n`);
  process.exit(1);
}

/** Return the markdown between `## <heading>` and the next `## `. */
function section(heading) {
  const start = md.indexOf(`## ${heading}`);
  if (start === -1) fail(`section "## ${heading}" not found`);
  const rest = md.slice(start + 3);
  const end = rest.indexOf('\n## ');
  return end === -1 ? rest : rest.slice(0, end);
}

/** First ```text fenced block inside a chunk of markdown. */
function fence(chunk, heading) {
  const m = chunk.match(/```text\n([\s\S]*?)```/);
  if (!m) fail(`no fenced block in "${heading}"`);
  return m[1];
}

/** Parse a `a · b · c` value list out of a fenced block. */
function dotList(heading) {
  const values = fence(section(heading), heading)
    .split(/[·\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!values.length) fail(`no values parsed from "${heading}"`);
  for (const v of values) {
    if (!/^[a-z0-9_]+$/.test(v)) fail(`value "${v}" in "${heading}" is not snake_case`);
  }
  return [...new Set(values)];
}

// --- 1. Categories and subcategories ---------------------------------------
function parseCategories() {
  const heading = '1. Categories and subcategories';
  const block = fence(section(heading), heading);
  const tree = {};
  let current = null;
  for (const raw of block.split('\n')) {
    const line = raw.trimEnd();
    const cat = line.match(/^([A-Z][A-Z_]*)$/);
    if (cat) {
      current = cat[1].toLowerCase();
      tree[current] = [];
      continue;
    }
    const sub = line.match(/^[├└]── ([a-z0-9_]+)$/);
    if (sub) {
      if (!current) fail(`subcategory "${sub[1]}" appears before any category`);
      tree[current].push(sub[1]);
    }
  }
  if (!Object.keys(tree).length) fail('no categories parsed');
  for (const [cat, subs] of Object.entries(tree)) {
    if (!subs.length) fail(`category "${cat}" has no subcategories`);
  }
  return tree;
}

// --- 2. Colours -------------------------------------------------------------
function parseColors() {
  const chunk = section('2. Colours');
  const colors = {};
  for (const line of chunk.split('\n')) {
    if (!line.startsWith('|')) continue;
    if (/^\|\s*Value/.test(line) || /^\|\s*-/.test(line)) continue;
    // Rows carry two (name, swatch) pairs.
    const re = /`([a-z0-9_]+)`\s*\|\s*(?:`(#[0-9A-Fa-f]{6})`|\*([^*]+)\*)/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      colors[m[1]] = m[2] ? m[2].toUpperCase() : null;
    }
  }
  if (!Object.keys(colors).length) fail('no colours parsed');
  return colors;
}

// --- 6. Sleeves, necklines, lengths ----------------------------------------
function parseSubFences() {
  const chunk = section('6. Sleeves, necklines, lengths');
  // Tolerates blank lines between the label and its fence: the source is
  // hand-authored markdown, and a formatter or an editor may reflow it.
  const blocks = [...chunk.matchAll(/\*\*([^*]+)\*\*\s*\n\s*```text\n([\s\S]*?)```/g)];
  if (blocks.length !== 4) fail(`expected 4 labelled blocks in section 6, found ${blocks.length}`);
  const out = {};
  for (const [, label, body] of blocks) {
    const key = label.trim().toLowerCase().replace(/\s+/g, '_');
    out[key] = body
      .split(/[·\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return out;
}

// --- 10. Garment status -----------------------------------------------------
function parseStatuses() {
  const chunk = section('10. Garment status');
  const statuses = [];
  const eligible = [];
  for (const line of chunk.split('\n')) {
    const m = line.match(/^\|\s*`([a-z_]+)`\s*\|([^|]*)\|([^|]*)\|/);
    if (!m) continue;
    statuses.push(m[1]);
    if (/yes/i.test(m[3])) eligible.push(m[1]);
  }
  if (!statuses.length) fail('no garment statuses parsed');
  if (!eligible.length) fail('no outfit-eligible statuses parsed');
  return { statuses, eligible };
}

// --- 12. Purchase candidate status -----------------------------------------
function parseCandidateStatuses() {
  const chunk = section('12. Purchase candidate status');
  const values = fence(chunk, 'purchase candidate status')
    .split(/[·\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const creates = [];
  for (const line of chunk.split('\n')) {
    const m = line.match(/^\|\s*`([a-z_]+)`\s*\|([^|]*)\|([^|]*)\|/);
    if (m && /yes/i.test(m[3])) creates.push(m[1]);
  }
  if (!values.length) fail('no purchase candidate statuses parsed');
  if (creates.length !== 1 || creates[0] !== 'confirmed_owned') {
    fail(
      `exactly one candidate status must create a garment and it must be confirmed_owned; ` +
        `parsed: [${creates.join(', ')}]`,
    );
  }
  return { values, creates };
}

// --- 15. Sizes --------------------------------------------------------------
function parseSizeSystems() {
  const chunk = section('15. Sizes');
  const systems = [];
  for (const line of chunk.split('\n')) {
    const m = line.match(/^\|\s*`([a-z0-9_]+)`\s*\|/);
    if (m) systems.push(m[1]);
  }
  if (!systems.length) fail('no size systems parsed');
  return systems;
}

// --- 16. Confidence bands ---------------------------------------------------
function parseConfidence() {
  const chunk = section('16. Confidence bands');
  const rows = {};
  for (const line of chunk.split('\n')) {
    const m = line.match(/^\|\s*(High|Medium|Low|Very low)\s*\|([^|]*)\|/);
    if (!m) continue;
    const nums = (m[2].match(/\d+\.\d+/g) ?? []).map(Number);
    rows[m[1].toLowerCase().replace(' ', '_')] = nums;
  }
  const high = rows['high']?.[0];
  const medium = rows['medium']?.[0];
  const low = rows['low']?.[0];
  if (high == null || medium == null || low == null) {
    fail('could not parse the High/Medium/Low confidence thresholds');
  }
  const auto = chunk.match(/requires\s*≥\s*(\d+\.\d+)/);
  if (!auto) fail('could not parse the auto-accept confidence threshold');
  return { high, medium, low, autoAccept: Number(auto[1]) };
}

// --- Assemble ---------------------------------------------------------------
const categories = parseCategories();
const colors = parseColors();
const sleeves = parseSubFences();
const { statuses, eligible } = parseStatuses();
const candidate = parseCandidateStatuses();
const confidence = parseConfidence();

const sets = {
  Category: Object.keys(categories),
  Subcategory: [...new Set(Object.values(categories).flat())],
  Color: Object.keys(colors),
  Pattern: dotList('3. Patterns'),
  Material: dotList('4. Materials'),
  Fit: dotList('5. Fit'),
  SleeveLength: sleeves['sleeve_length'],
  SleeveType: sleeves['sleeve_type'],
  Neckline: sleeves['neckline'],
  Length: sleeves['length'],
  Season: dotList('7. Season'),
  Occasion: dotList('8. Occasion'),
  StyleTag: dotList('9. Style tags'),
  GarmentStatus: statuses,
  SourceType: dotList('11. Garment source'),
  PurchaseCandidateStatus: candidate.values,
  ImageKind: dotList('13. Garment image kind'),
  OutfitSlot: dotList('14. Outfit slots'),
  SizeSystem: parseSizeSystems(),
};

const lit = (v) => JSON.stringify(v);

/** Type name -> exported constant name. Explicit, because naive pluralization
 *  produces CATEGORYS and GARMENTSTATUSS. */
const CONST_NAMES = {
  Category: 'CATEGORIES',
  Subcategory: 'SUBCATEGORIES',
  Color: 'COLORS',
  Pattern: 'PATTERNS',
  Material: 'MATERIALS',
  Fit: 'FITS',
  SleeveLength: 'SLEEVE_LENGTHS',
  SleeveType: 'SLEEVE_TYPES',
  Neckline: 'NECKLINES',
  Length: 'LENGTHS',
  Season: 'SEASONS',
  Occasion: 'OCCASIONS',
  StyleTag: 'STYLE_TAGS',
  GarmentStatus: 'GARMENT_STATUSES',
  SourceType: 'SOURCE_TYPES',
  PurchaseCandidateStatus: 'PURCHASE_CANDIDATE_STATUSES',
  ImageKind: 'IMAGE_KINDS',
  OutfitSlot: 'OUTFIT_SLOTS',
  SizeSystem: 'SIZE_SYSTEMS',
};

const constName = (name) => {
  const c = CONST_NAMES[name];
  if (!c) fail(`no constant name mapped for type "${name}" — add it to CONST_NAMES`);
  return c;
};

const asConst = (name, values) => {
  const c = constName(name);
  return (
    `export const ${c} = [\n${values.map((v) => `  ${lit(v)},`).join('\n')}\n] as const;\n` +
    `export type ${name} = (typeof ${c})[number];\n` +
    `export const is${name} = (v: unknown): v is ${name} =>\n` +
    `  typeof v === 'string' && (${c} as readonly string[]).includes(v);\n`
  );
};

const parts = [];
parts.push(`/* eslint-disable */
// ---------------------------------------------------------------------------
// GENERATED FILE — DO NOT EDIT.
//
// Source:    docs/04-data/taxonomy.md
// Regenerate: npm run generate:taxonomy
//
// docs/04-data/taxonomy.md is the single source of truth for every enumerated
// value in Mira. Application code reads these types; it never widens them
// (INV-1). AI output is clamped to these values before persistence (AI-3).
// ---------------------------------------------------------------------------
`);

for (const [name, values] of Object.entries(sets)) {
  if (!values || !values.length) fail(`empty value set for ${name}`);
  parts.push(asConst(name, values));
}

parts.push(`/** Subcategories that belong to each category. A subcategory must belong to its
 *  category — \`dresses/heels\` is invalid (taxonomy §1). */
export const CATEGORY_SUBCATEGORIES: Readonly<Record<Category, readonly Subcategory[]>> = {
${Object.entries(categories)
  .map(([c, subs]) => `  ${c}: [${subs.map(lit).join(', ')}],`)
  .join('\n')}
} as const;

export const isSubcategoryOf = (category: Category, subcategory: string): boolean =>
  (CATEGORY_SUBCATEGORIES[category] as readonly string[]).includes(subcategory);
`);

parts.push(`/** Swatch values for the colour filter UI. These are UI swatches, not the
 *  garment's real colour. \`multicolor\` has no single swatch. */
export const COLOR_SWATCHES: Readonly<Record<Color, string | null>> = {
${Object.entries(colors)
  .map(([c, hex]) => `  ${c}: ${hex === null ? 'null' : lit(hex)},`)
  .join('\n')}
} as const;
`);

parts.push(`/** Only these statuses participate in generated outfits (INV-2, D-012). */
export const OUTFIT_ELIGIBLE_STATUSES = [
${eligible.map((s) => `  ${lit(s)},`).join('\n')}
] as const;

export type OutfitEligibleStatus = (typeof OUTFIT_ELIGIBLE_STATUSES)[number];

export const isOutfitEligible = (status: GarmentStatus): boolean =>
  (OUTFIT_ELIGIBLE_STATUSES as readonly string[]).includes(status);
`);

parts.push(`/** The only candidate status that creates a garment (OWN-1, ADR 0003). */
export const GARMENT_CREATING_CANDIDATE_STATUSES = [
${candidate.creates.map((s) => `  ${lit(s)},`).join('\n')}
] as const;

export const createsGarment = (status: PurchaseCandidateStatus): boolean =>
  (GARMENT_CREATING_CANDIDATE_STATUSES as readonly string[]).includes(status);
`);

parts.push(`/** Confidence bands (taxonomy §16). Bands, not raw numbers, reach the UI (D-011). */
export const CONFIDENCE = {
  high: ${confidence.high},
  medium: ${confidence.medium},
  low: ${confidence.low},
  /** Opt-in automatic purchase import also requires a matching identifier. */
  autoAccept: ${confidence.autoAccept},
} as const;

export type ConfidenceBand = 'high' | 'medium' | 'low' | 'very_low';

export const confidenceBand = (value: number): ConfidenceBand => {
  if (value >= CONFIDENCE.high) return 'high';
  if (value >= CONFIDENCE.medium) return 'medium';
  if (value >= CONFIDENCE.low) return 'low';
  return 'very_low';
};
`);

const generated = parts.join('\n');

if (CHECK) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;
  if (current !== generated) {
    console.error(
      `\n  generate-taxonomy: ${OUT}\n` +
        `  is out of date with ${SOURCE}.\n\n` +
        `  The generated file is never edited by hand (INV-1). Run:\n` +
        `    npm run generate:taxonomy\n` +
        `  and commit the result.\n`,
    );
    process.exit(1);
  }
  console.log('generate-taxonomy: generated.ts is up to date');
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, generated, 'utf8');

const counts = Object.entries(sets)
  .map(([k, v]) => `${k}=${v.length}`)
  .join(' ');
console.log(`generate-taxonomy: wrote ${OUT}`);
console.log(`  ${counts}`);
console.log(`  outfit-eligible=${eligible.join(',')}  autoAccept=${confidence.autoAccept}`);
