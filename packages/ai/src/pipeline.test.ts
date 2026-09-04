import { describe, expect, it } from 'vitest';
import { GarmentUnderstandingSchema, OutfitProposalsSchema } from './contracts.js';
import {
  normalizeConfidenceMap,
  parseAndValidate,
  parseStrictJson,
  resolveCandidateIds,
  validate,
} from './pipeline.js';
import { clampUnderstanding } from './clamp.js';
import { stubProviders } from './stub-provider.js';

const validGarment = {
  category: 'dresses',
  subcategory: 'midi_dress',
  brand: null,
  product_name: null,
  colors: ['black'],
  pattern: 'solid',
  materials: ['polyester'],
  style: ['minimal'],
  fit: 'regular',
  sleeve_length: 'sleeveless',
  sleeve_type: 'none',
  neckline: 'square',
  length: 'midi',
  season: ['summer'],
  occasion: ['dinner'],
  size: null,
  confidence: { category: 0.97 },
};

describe('parsing (AI-2, R1)', () => {
  it('rejects an empty response', () => {
    const r = parseStrictJson('   ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.reason).toBe('empty');
  });

  it('rejects prose wrapped around JSON rather than rescuing it with a regex', () => {
    const r = parseStrictJson('Here is the JSON:\n```json\n{"category":"dresses"}\n```');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.reason).toBe('parse');
  });

  it('accepts strict JSON', () => {
    const r = parseStrictJson('{"category":"dresses"}');
    expect(r.ok).toBe(true);
  });
});

describe('schema validation (AI-2)', () => {
  it('accepts a valid garment understanding', () => {
    expect(validate(GarmentUnderstandingSchema, validGarment).ok).toBe(true);
  });

  it('rejects an out-of-taxonomy category rather than coercing it (AI-3)', () => {
    const r = validate(GarmentUnderstandingSchema, { ...validGarment, category: 'outfits' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.reason).toBe('schema');
      expect(r.failure.detail).toContain('category');
    }
  });

  it('rejects a confidence outside [0,1]', () => {
    const r = validate(GarmentUnderstandingSchema, {
      ...validGarment,
      confidence: { category: 1.4 },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects a missing required field', () => {
    const { category: _category, ...rest } = validGarment;
    expect(validate(GarmentUnderstandingSchema, rest).ok).toBe(false);
  });

  it('parses and validates in one step', () => {
    expect(parseAndValidate(GarmentUnderstandingSchema, JSON.stringify(validGarment)).ok).toBe(
      true,
    );
  });
});

describe('confidence normalization (AI-1, R2)', () => {
  it('clamps into [0,1] and drops non-numeric entries', () => {
    expect(normalizeConfidenceMap({ a: 1.5, b: -1, c: 0.42, d: 'high', e: null })).toEqual({
      a: 1,
      b: 0,
      c: 0.42,
    });
  });

  it('returns an empty map for non-object input rather than throwing', () => {
    expect(normalizeConfidenceMap('nope')).toEqual({});
    expect(normalizeConfidenceMap(null)).toEqual({});
  });
});

describe('candidate id resolution (AI-6) — hallucinated garments are a hard gate', () => {
  const candidates = new Map([
    ['g1', '11111111-1111-1111-1111-111111111111'],
    ['g2', '22222222-2222-2222-2222-222222222222'],
  ]);

  it('resolves ids the server offered', () => {
    const r = resolveCandidateIds([{ garment_id: 'g1' }, { garment_id: 'g2' }], candidates);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items.map((i) => i.resolvedGarmentId)).toEqual([
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
      ]);
    }
  });

  it('rejects an id the server never offered', () => {
    const r = resolveCandidateIds([{ garment_id: 'g1' }, { garment_id: 'g99' }], candidates);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.unknownId).toBe('g99');
  });

  it('rejects a plausible-looking uuid the model invented', () => {
    const r = resolveCandidateIds(
      [{ garment_id: '33333333-3333-3333-3333-333333333333' }],
      candidates,
    );
    expect(r.ok).toBe(false);
  });
});

describe('stub providers', () => {
  it('produces output that survives the clamp with nothing dropped', async () => {
    const raw = await stubProviders.vision.analyzeGarment({ images: [{ storageKey: 'k' }] });
    const { drops } = clampUnderstanding(JSON.parse(raw.text) as Record<string, unknown>);

    expect(
      drops,
      `stub output is not taxonomy-valid: ${drops.map((d) => d.field).join(', ')}`,
    ).toEqual([]);
  });

  it('reports which provider and model produced it (AI-1)', async () => {
    // garment_attributes records the author of every value; a stub that
    // omitted this would let the persistence path go untested.
    const raw = await stubProviders.vision.analyzeGarment({ images: [{ storageKey: 'k' }] });
    expect(raw.provider).toBeTruthy();
    expect(raw.model).toBeTruthy();
  });

  it('never guesses a brand (D-014)', async () => {
    const raw = await stubProviders.vision.analyzeGarment({ images: [{ storageKey: 'k' }] });
    const { value } = clampUnderstanding(JSON.parse(raw.text) as Record<string, unknown>);
    expect(value.brand).toBeNull();
  });

  it('only references ids from the supplied candidate set (AI-6)', async () => {
    const r = await stubProviders.reasoning.generateOutfits({
      prompt: 'dinner',
      vibe: [],
      priority: null,
      count: 1,
      candidates: [
        {
          shortId: 'g1',
          garmentId: 'uuid-1',
          category: 'tops',
          subcategory: null,
          primaryColor: 'black',
          brand: null,
          name: null,
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value[0]?.items[0]?.garment_id).toBe('g1');
  });

  it('returns null from segmentation, exercising the original-image fallback', async () => {
    expect(await stubProviders.segmentation.cutout({ storageKey: 'k' })).toBeNull();
  });

  it('produces stable embeddings of the right dimensionality', async () => {
    const a = await stubProviders.embedding.embedText('black dress');
    const b = await stubProviders.embedding.embedText('black dress');
    expect(a).toHaveLength(1024);
    expect(a).toEqual(b);
  });
});

describe('OutfitProposal contract', () => {
  it('rejects an unknown slot', () => {
    const r = validate(OutfitProposalsSchema, [
      {
        title: 'x',
        rationale: null,
        items: [{ slot: 'jewellery', garment_id: 'g1' }],
        missing_slots: [],
      },
    ]);
    expect(r.ok).toBe(false);
  });

  it('accepts missing_slots — the model must be able to say the closet cannot fill a slot', () => {
    const r = validate(OutfitProposalsSchema, [
      { title: 'x', rationale: null, items: [], missing_slots: ['shoes'] },
    ]);
    expect(r.ok).toBe(true);
  });
});
