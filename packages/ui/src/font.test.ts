import { describe, expect, it } from 'vitest';
import { font, fontFamilyForWeight, type } from './tokens.js';

/**
 * The single point of failure for every piece of type in the app.
 *
 * On iOS, `fontWeight` selects nothing once `fontFamily` names a custom face:
 * asking for Archivo at 600 renders Archivo Regular, silently and without an
 * error. So if this mapping is wrong, every heading in Mira quietly becomes
 * body copy and no test, build or lint notices.
 */
describe('resolving a weight to a face', () => {
  it.each([
    ['400', font.regular],
    ['500', font.medium],
    ['600', font.semibold],
    ['700', font.bold],
    ['bold', font.bold],
  ])('renders weight %s as %s', (weight, expected) => {
    expect(fontFamilyForWeight(weight)).toBe(expected);
  });

  it('accepts a number, because RN style values are not always strings', () => {
    expect(fontFamilyForWeight(600)).toBe(font.semibold);
  });

  it('falls back to regular for an unset weight', () => {
    expect(fontFamilyForWeight(undefined)).toBe(font.regular);
  });

  it('rounds an unbundled weight down rather than back to the system face', () => {
    // A heading in SF Pro beside body copy in Archivo is more obviously wrong
    // than a heading that is slightly light.
    expect(fontFamilyForWeight('900')).toBe(font.bold);
    expect(fontFamilyForWeight('100')).toBe(font.regular);
  });

  it('has a bundled face for every weight the type scale asks for', () => {
    // The scale is the contract: a token whose weight has no face is a heading
    // that renders at the wrong weight on a device and nowhere else.
    for (const [name, token] of Object.entries(type)) {
      const family = fontFamilyForWeight(token.fontWeight);
      expect(Object.values(font), `${name} (${token.fontWeight})`).toContain(family);
    }
  });
});
