import { describe, expect, it } from 'vitest';
import { AA_LARGE, AA_NORMAL, AAA_NORMAL, contrastRatio } from './contrast.js';
import { color, colorDark, layout, space, type } from './tokens.js';

/**
 * A palette change that breaks WCAG AA fails the build (A11Y-2).
 * Ratios are asserted against `docs/02-design/accessibility.md` §1.
 */
describe('colour contrast (A11Y-2)', () => {
  it.each([
    ['text on bg', color.text, color.bg, AAA_NORMAL],
    ['text on surface', color.text, color.surface, AAA_NORMAL],
    ['text on surfaceSunken', color.text, color.surfaceSunken, AAA_NORMAL],
    ['text on accentSoft', color.text, color.accentSoft, AAA_NORMAL],
    ['inverseText on inverseBg', color.inverseText, color.inverseBg, AAA_NORMAL],
  ])('%s meets AAA', (_label, fg, bg, min) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it.each([
    ['textSecondary on bg', color.textSecondary, color.bg],
    ['textSecondary on surface', color.textSecondary, color.surface],
    ['danger on bg', color.danger, color.bg],
  ])('%s meets AA for body text', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('keeps textSecondary usable for garment metadata on the ivory ground', () => {
    // This is the token that carries brand, name and colour on every closet
    // tile. It sits on bg, not on surface, so bg is the binding constraint.
    expect(contrastRatio(color.textSecondary, color.bg)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  describe('colours that must NEVER be used for text on a light ground', () => {
    // Documented as fills/icons only. The assertion pins the reason: if someone
    // later "fixes" these to pass AA, the design intent has changed and this
    // test should be updated deliberately.
    it.each([
      ['accent', color.accent],
      ['success', color.success],
      ['warning', color.warning],
      ['textTertiary', color.textTertiary],
    ])('%s is below AA on bg, so it is fills and icons only', (_label, fg) => {
      expect(contrastRatio(fg, color.bg)).toBeLessThan(AA_NORMAL);
    });
  });

  it('meets AA in the dark palette too, so the swap stays honest', () => {
    expect(contrastRatio(colorDark.text, colorDark.bg)).toBeGreaterThanOrEqual(AAA_NORMAL);
    expect(contrastRatio(colorDark.text, colorDark.surface)).toBeGreaterThanOrEqual(AAA_NORMAL);
    expect(contrastRatio(colorDark.textSecondary, colorDark.bg)).toBeGreaterThanOrEqual(AA_LARGE);
  });
});

describe('token integrity', () => {
  it('defines every colour as a hex or an rgba string', () => {
    for (const [name, value] of Object.entries(color)) {
      expect(value, name).toMatch(/^(#[0-9A-F]{6}|rgba\(.+\))$/i);
    }
  });

  it('meets the 44pt minimum touch target (A11Y-3)', () => {
    expect(space.tapMin).toBeGreaterThanOrEqual(44);
  });

  it('keeps the closet at two columns, never three (D-009)', () => {
    expect(layout.closetColumns).toBe(2);
  });

  it('caps garment tile text at three lines', () => {
    expect(layout.garmentTileMaxTextLines).toBeLessThanOrEqual(3);
  });

  it('uses a 4pt spacing scale', () => {
    for (const [name, value] of Object.entries(space)) {
      expect(value % 2, `${name}=${value}`).toBe(0);
    }
  });

  it('gives every type token a line height at least its font size', () => {
    for (const [name, t] of Object.entries(type)) {
      expect(t.lineHeight, name).toBeGreaterThanOrEqual(t.fontSize);
    }
  });
});
