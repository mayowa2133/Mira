import { describe, expect, it } from 'vitest';
import { derivedKey } from './keys.js';

describe('derivedKey', () => {
  /**
   * The bug this exists for: upload keys put every image for a user in ONE
   * directory, so deriving from the directory gave every capture the same
   * derivative key and each one overwrote the last.
   */
  it('is unique per original, not per directory', () => {
    const a = derivedKey('garments/user-1/1788466300051-capture.jpg', 'thumb', 'webp');
    const b = derivedKey('garments/user-1/1788466400000-capture.jpg', 'thumb', 'webp');

    expect(a).not.toBe(b);
    expect(a).toBe('garments/user-1/1788466300051-capture-thumb.webp');
  });

  it('keeps derivatives under the same user prefix', () => {
    // Deleting a user's data must stay a prefix operation.
    expect(derivedKey('garments/user-1/photo.jpg', 'medium', 'webp')).toMatch(
      /^garments\/user-1\//,
    );
  });

  it('handles a nested key', () => {
    expect(derivedKey('garments/user-1/garment-9/original.jpg', 'thumb', 'webp')).toBe(
      'garments/user-1/garment-9/original-thumb.webp',
    );
  });

  it('does not mistake a dot in a directory for an extension', () => {
    expect(derivedKey('garments/user.1/original', 'thumb', 'webp')).toBe(
      'garments/user.1/original-thumb.webp',
    );
  });

  it('handles a key with no extension', () => {
    expect(derivedKey('garments/user-1/photo', 'thumb', 'webp')).toBe(
      'garments/user-1/photo-thumb.webp',
    );
  });
});
