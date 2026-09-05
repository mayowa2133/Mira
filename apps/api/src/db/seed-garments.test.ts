import { describe, expect, it } from 'vitest';
import { buildRealisticCloset } from './seed-garments.js';

/**
 * What a seeded name is allowed to look like.
 *
 * `seed-data.md` exists so every environment can demonstrate a *believable*
 * closet, and a name is the most-read thing on a tile after the photograph.
 * Both rules below were written after seeing the failure on a device: the
 * duplicates sort to the top of the closet, so a bad name here is not buried in
 * a list of 227 — it is the first thing anyone sees.
 */
describe('the realistic closet', () => {
  const closet = buildRealisticCloset();

  it('never uses a taxonomy bucket as a word for clothing', () => {
    // Most categories carry an `other` subcategory. Using it as the product
    // noun produced "Silk Other", on the tile, in the demo.
    for (const garment of closet) {
      expect(garment.name, garment.name).not.toMatch(/\bOther\b/);
    }
  });

  it('gives every garment a descriptor and a noun', () => {
    for (const garment of closet) {
      expect(garment.name.trim().split(/\s+/).length, garment.name).toBeGreaterThanOrEqual(2);
    }
  });

  it('makes a near-duplicate a different CUT, not the same name with a word bolted on', () => {
    // These pairs exist to test duplicate-detection precision, so they must be
    // genuinely similar-but-different. Appending a suffix produced "Slip Midi
    // Dress" beside "Slip Midi Dress Crew" — which is not a different cut, it
    // reads as a typo.
    const byKey = new Map<string, string[]>();
    for (const garment of closet) {
      const key = `${garment.brandRaw}|${garment.primaryColor}|${garment.category}`;
      byKey.set(key, [...(byKey.get(key) ?? []), garment.name]);
    }

    for (const names of byKey.values()) {
      for (const a of names) {
        for (const b of names) {
          if (a === b) continue;
          expect(b.startsWith(`${a} `), `"${b}" is "${a}" with a suffix`).toBe(false);
        }
      }
    }
  });

  it('still produces the duplicates the duplicate sheet needs', () => {
    // 3 genuine duplicates and 4 near-duplicate pairs (seed-data.md).
    const exact = new Set<string>();
    let repeats = 0;
    for (const garment of closet) {
      const key = `${garment.brandRaw}|${garment.name}|${garment.primaryColor}`;
      if (exact.has(key)) repeats += 1;
      exact.add(key);
    }
    expect(repeats).toBeGreaterThanOrEqual(3);
  });
});
