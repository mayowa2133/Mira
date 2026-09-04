import { describe, expect, it } from 'vitest';
import {
  CHOICES,
  candidateToAskAbout,
  consequenceOf,
  describeGarment,
  headlineFor,
  type DuplicateCandidate,
} from './duplicate-sheet';

function candidate(overrides: Partial<DuplicateCandidate> = {}): DuplicateCandidate {
  return {
    existing_garment: {
      id: 'g1',
      name: 'Contour Bodysuit',
      brand: { id: 'b1', name: 'Aritzia' },
      brand_raw: 'Aritzia',
      category: 'tops',
      primary_color: 'black',
      canonical_image: null,
    },
    score: 0.92,
    band: 'ask',
    signals: ['brand_name'],
    summary: 'Same brand and a very similar name',
    ...overrides,
  };
}

describe('which candidate to ask about', () => {
  it('asks about nothing when nothing is worth interrupting for', () => {
    expect(candidateToAskAbout([])).toBeNull();
  });

  it('never interrupts for the quiet band', () => {
    // §3: below 0.70 Mira saves silently and raises it later.
    expect(candidateToAskAbout([candidate({ band: 'note', score: 0.55 })])).toBeNull();
  });

  it('asks about one pair, the strongest', () => {
    const weaker = candidate({ band: 'ask_softly', score: 0.72 });
    const stronger = candidate({
      band: 'ask',
      score: 0.99,
      existing_garment: { ...candidate().existing_garment, id: 'g2' },
    });

    expect(candidateToAskAbout([weaker, stronger])?.existing_garment.id).toBe('g2');
  });

  it('ignores quiet candidates when picking the strongest', () => {
    // A `note` at 0.69 must not outrank an `ask_softly` at 0.71 by score alone.
    const quiet = candidate({ band: 'note', score: 0.69 });
    const asking = candidate({
      band: 'ask_softly',
      score: 0.71,
      existing_garment: { ...candidate().existing_garment, id: 'g3' },
    });

    expect(candidateToAskAbout([quiet, asking])?.existing_garment.id).toBe('g3');
  });
});

describe('how firmly the question is put', () => {
  it('uses the spec’s line when Mira is confident', () => {
    expect(headlineFor('ask')).toBe('This may already be in your closet.');
  });

  it('asks openly when it is not', () => {
    // §3 says "worded more softly", and §7 puts the most damaging false merge
    // squarely in this band.
    const soft = headlineFor('ask_softly');
    expect(soft).not.toBe(headlineFor('ask'));
    expect(soft.endsWith('?')).toBe(true);
  });
});

describe('describing each piece', () => {
  it('reads as the spec’s comparison line', () => {
    expect(describeGarment(candidate().existing_garment)).toBe('Aritzia Contour Bodysuit — Black');
  });

  it('still names a garment Mira knows nothing about', () => {
    // The same rule as a closet tile: never a bare colour, never nothing.
    expect(
      describeGarment({
        name: null,
        brand: null,
        brand_raw: null,
        category: 'dresses',
        primary_color: 'black',
      }),
    ).toBe('A dress — Black');
  });

  it('does not trail a dash when there is no colour', () => {
    expect(
      describeGarment({
        name: 'Wool Coat',
        brand: null,
        brand_raw: null,
        category: 'outerwear',
        primary_color: null,
      }),
    ).toBe('Wool Coat');
  });
});

describe('the three answers', () => {
  it('offers exactly what §4 offers', () => {
    expect(CHOICES.map((c) => c.label)).toEqual([
      "It's the same item",
      'I own two',
      "They're different",
    ]);
  });

  it('says what merging costs before it is chosen', () => {
    // The one answer that cannot be undone by deleting a garment afterwards.
    expect(consequenceOf('same_item')).toContain('Nothing is lost');
  });

  it('promises not to ask again about a pair the user has settled', () => {
    expect(consequenceOf('owns_two')).toContain("won't ask about this pair again");
  });
});
