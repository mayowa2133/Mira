import { describe, expect, it } from 'vitest';
import { ApiError } from '../../http/errors.js';
import { EMPTY_PREFERENCES, validatePreferences } from './service.js';

const prefs = (over: Partial<typeof EMPTY_PREFERENCES> = {}) => ({ ...EMPTY_PREFERENCES, ...over });

describe('validating style preferences', () => {
  it('accepts taxonomy members', () => {
    expect(() =>
      validatePreferences(prefs({ preferred_styles: ['minimal'], preferred_colors: ['black'] })),
    ).not.toThrow();
  });

  it('refuses a style the taxonomy does not have', () => {
    // INV-1: the taxonomy is never widened from application code, and a
    // preference for a style nothing can be tagged with is a preference that
    // silently does nothing.
    try {
      validatePreferences(prefs({ preferred_styles: ['cottagecore-adjacent'] }));
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe('not_in_taxonomy');
    }
  });

  it('refuses a colour the taxonomy does not have', () => {
    expect(() => validatePreferences(prefs({ avoided_colors: ['puce'] }))).toThrow(ApiError);
  });

  it('refuses wanting and avoiding the same style', () => {
    // The stylist would have to pick a side, and either choice looks like a
    // bug to whoever set them.
    expect(() =>
      validatePreferences(prefs({ preferred_styles: ['minimal'], avoided_styles: ['minimal'] })),
    ).toThrow(ApiError);
  });

  it('refuses wanting and avoiding the same colour', () => {
    expect(() =>
      validatePreferences(prefs({ preferred_colors: ['black'], avoided_colors: ['black'] })),
    ).toThrow(ApiError);
  });

  it('allows preferring one thing and avoiding another', () => {
    expect(() =>
      validatePreferences(prefs({ preferred_colors: ['black'], avoided_colors: ['yellow'] })),
    ).not.toThrow();
  });

  it('refuses a duplicate rather than silently keeping one', () => {
    expect(() => validatePreferences(prefs({ preferred_styles: ['minimal', 'minimal'] }))).toThrow(
      ApiError,
    );
  });

  it('caps how many can be set', () => {
    const many = Array.from({ length: 21 }, (_, i) => `style-${i}`);
    expect(() => validatePreferences(prefs({ preferred_styles: many }))).toThrow(ApiError);
  });

  it('treats empty as valid, because it is the starting state', () => {
    expect(() => validatePreferences(EMPTY_PREFERENCES)).not.toThrow();
  });
});
