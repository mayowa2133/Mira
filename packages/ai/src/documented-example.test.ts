import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { clampUnderstanding } from './clamp.js';

/**
 * The example response in `docs/06-ai/garment-understanding.md` §1 must be
 * taxonomy-valid.
 *
 * It is not decoration: §5 says the prompt enumerates the taxonomy, so that
 * example is what a prompt author copies and what a model is steered toward. It
 * had drifted — `"category": "dress"` (the taxonomy says `dresses`) and
 * `"style": ["going_out", "evening"]`, where `going_out` is an OCCASION and
 * `evening` is in no set at all. A model following it faithfully would have had
 * three fields silently clamped away.
 *
 * Reading the document rather than restating it is the point: a copy here would
 * drift the same way, quietly.
 */
const DOC = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../docs/06-ai/garment-understanding.md',
);

function firstJsonBlock(markdown: string): unknown {
  const match = /```json\n([\s\S]*?)```/.exec(markdown);
  if (!match?.[1]) throw new Error('no JSON block found in garment-understanding.md');
  return JSON.parse(match[1]) as unknown;
}

describe('the documented output contract', () => {
  it('survives the clamp with nothing dropped', () => {
    const example = firstJsonBlock(readFileSync(DOC, 'utf8')) as Record<string, unknown>;
    const { drops } = clampUnderstanding(example);

    expect(
      drops,
      `The example in garment-understanding.md §1 contains values the taxonomy ` +
        `does not have: ${drops.map((d) => `${d.field}=${String(d.value)}`).join(', ')}`,
    ).toEqual([]);
  });

  it('round-trips every field it documents', () => {
    const example = firstJsonBlock(readFileSync(DOC, 'utf8')) as Record<string, unknown>;
    const { value } = clampUnderstanding(example);

    // Not just "nothing dropped" — the values actually arrive.
    expect(value.category).toBe(example['category']);
    expect(value.subcategory).toBe(example['subcategory']);
    expect(value.colors).toEqual(example['colors']);
    expect(value.pattern).toBe(example['pattern']);
    expect(value.occasion).toEqual(example['occasion']);
  });
});
