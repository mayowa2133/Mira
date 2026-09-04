import { afterEach, describe, expect, it, vi } from 'vitest';
import { idempotencyKey } from './ids';

const original = globalThis.crypto;

afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
});

describe('idempotency keys', () => {
  it('does not throw where crypto.randomUUID does not exist', () => {
    // Hermes. The whole reason this module exists.
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    expect(() => idempotencyKey()).not.toThrow();
    expect(idempotencyKey().length).toBeGreaterThan(8);
  });

  it('is still unique without it', () => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    const keys = new Set(Array.from({ length: 2000 }, () => idempotencyKey()));
    expect(keys.size).toBe(2000);
  });

  it('uses the platform generator when there is one', () => {
    const randomUUID = vi.fn(() => 'from-platform');
    Object.defineProperty(globalThis, 'crypto', { value: { randomUUID }, configurable: true });
    expect(idempotencyKey()).toBe('from-platform');
  });

  it('survives a crypto object without randomUUID', () => {
    // React Native does provide `crypto.getRandomValues` in some setups, which
    // makes the object exist while the method still does not.
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: () => undefined },
      configurable: true,
    });
    expect(() => idempotencyKey()).not.toThrow();
  });
});
