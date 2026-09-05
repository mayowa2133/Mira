import { describe, expect, it } from 'vitest';
import {
  OWNERSHIP_ANSWERS,
  candidateLabel,
  footerLabel,
  headerLabel,
  retailerCounts,
  toggleSelection,
} from './review';

describe('the ownership sheet (§8)', () => {
  it('offers exactly the five answers §8 lists, in order', () => {
    expect(OWNERSHIP_ANSWERS.map((a) => a.label)).toEqual([
      'Yes — in my closet',
      'Returned it',
      'Sold / donated',
      'Not mine',
      'Not sure',
    ]);
  });

  it('puts something in the closet for exactly one answer (OWN-1)', () => {
    expect(OWNERSHIP_ANSWERS.filter((a) => a.addsToCloset).map((a) => a.status)).toEqual([
      'confirmed_owned',
    ]);
  });

  it('maps every answer onto a real §12 status', () => {
    const valid = [
      'detected',
      'processing',
      'needs_review',
      'confirmed_owned',
      'returned',
      'not_mine',
      'removed',
      'uncertain',
      'ignored',
    ];
    for (const answer of OWNERSHIP_ANSWERS) expect(valid).toContain(answer.status);
  });

  it('does not force a decision', () => {
    // "Not sure" keeps the candidate reviewable rather than dismissing it.
    const unsure = OWNERSHIP_ANSWERS.find((a) => a.key === 'unsure');
    expect(unsure?.status).toBe('uncertain');
    expect(unsure?.addsToCloset).toBe(false);
  });
});

describe('the footer and header', () => {
  it('says what tapping will do, and is honest about zero', () => {
    expect(footerLabel(0)).toBe('Select pieces to add');
    expect(footerLabel(1)).toBe('Add 1 item to my closet');
    expect(footerLabel(97)).toBe('Add 97 items to my closet');
  });

  it('uses §8’s header', () => {
    expect(headerLabel(126)).toBe('We found 126 pieces 👀');
    expect(headerLabel(1)).toBe('We found 1 piece 👀');
  });

  it('does not say it found nothing with an emoji', () => {
    expect(headerLabel(0)).toBe('Nothing to review');
  });
});

describe('selection', () => {
  it('adds and removes', () => {
    expect(toggleSelection([], 'a')).toEqual(['a']);
    expect(toggleSelection(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('the retailer strip', () => {
  it('orders by how much was bought there', () => {
    const counts = retailerCounts([
      { retailer: 'Zara' },
      { retailer: 'Aritzia' },
      { retailer: 'Aritzia' },
    ]);
    expect(counts[0]).toEqual({ retailer: 'Aritzia', count: 2 });
  });

  it('keeps purchases it could not attribute', () => {
    // A purchase with no retailer is still a purchase to review.
    const counts = retailerCounts([{ retailer: null }, { retailer: 'Zara' }]);
    expect(counts.map((c) => c.retailer)).toContain(null);
  });
});

describe('naming a candidate', () => {
  it('prefers the cleaned name but never shows nothing', () => {
    expect(
      candidateLabel({
        product_name: 'Contour Bodysuit',
        raw_item_name: 'ITEM 4',
        brand: 'Aritzia',
      }),
    ).toBe('Aritzia Contour Bodysuit');
  });

  it('falls back to what the source literally said', () => {
    // Keeping the raw name is why a bad clean-up is recoverable.
    expect(
      candidateLabel({ product_name: null, raw_item_name: 'BODYSUIT BLK S', brand: null }),
    ).toBe('BODYSUIT BLK S');
  });
});
