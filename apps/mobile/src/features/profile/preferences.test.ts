import { describe, expect, it } from 'vitest';
import { EMPTY_PREFERENCES, toggle } from './preferences-core';

describe('toggling a preference', () => {
  it('adds and removes', () => {
    const on = toggle(EMPTY_PREFERENCES, 'preferred_styles', 'minimal');
    expect(on.preferred_styles).toEqual(['minimal']);
    expect(toggle(on, 'preferred_styles', 'minimal').preferred_styles).toEqual([]);
  });

  it('cannot build a contradiction the server would reject', () => {
    // Letting someone construct an invalid state and refusing it on save is a
    // UI that wasted their time.
    const avoided = toggle(EMPTY_PREFERENCES, 'avoided_styles', 'minimal');
    const both = toggle(avoided, 'preferred_styles', 'minimal');

    expect(both.preferred_styles).toEqual(['minimal']);
    expect(both.avoided_styles).toEqual([]);
  });

  it('works the same way for colours', () => {
    const preferred = toggle(EMPTY_PREFERENCES, 'preferred_colors', 'black');
    const flipped = toggle(preferred, 'avoided_colors', 'black');

    expect(flipped.avoided_colors).toEqual(['black']);
    expect(flipped.preferred_colors).toEqual([]);
  });

  it('leaves other values alone', () => {
    const start = toggle(
      toggle(EMPTY_PREFERENCES, 'preferred_colors', 'black'),
      'preferred_colors',
      'navy',
    );
    const after = toggle(start, 'avoided_colors', 'black');

    expect(after.preferred_colors).toEqual(['navy']);
  });
});
