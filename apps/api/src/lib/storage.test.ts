import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  BUCKETS,
  buildStorageKey,
  bucketOf,
  createLocalStorage,
  isSafeStorageKey,
  userOf,
} from './storage.js';

const root = mkdtempSync(join(tmpdir(), 'mira-storage-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const storage = createLocalStorage({
  root,
  secret: 'test-secret',
  publicBaseUrl: 'http://localhost:4000/v1',
});

const ALICE = '11111111-1111-1111-1111-111111111111';
const MALLORY = '22222222-2222-2222-2222-222222222222';

describe('storage keys', () => {
  it('prefixes by bucket then user, so deletion is a prefix operation', () => {
    expect(buildStorageKey('garments', ALICE, 'g1', 'original.jpg')).toBe(
      `garments/${ALICE}/g1/original.jpg`,
    );
  });

  it('reads back the bucket and owner', () => {
    const key = buildStorageKey('body', ALICE, 'front.jpg');
    expect(bucketOf(key)).toBe('body');
    expect(userOf(key)).toBe(ALICE);
  });

  it.each([
    ['traversal', `garments/${ALICE}/../../etc/passwd`],
    ['absolute', '/etc/passwd'],
    ['null byte', `garments/${ALICE}/a\0b`],
    ['unknown bucket', `secrets/${ALICE}/a.jpg`],
    ['no owner', 'garments'],
    ['empty', ''],
  ])('rejects an unsafe key: %s', (_label, key) => {
    expect(isSafeStorageKey(key)).toBe(false);
  });

  it('accepts a well-formed key', () => {
    expect(isSafeStorageKey(`garments/${ALICE}/g1/original.jpg`)).toBe(true);
  });
});

describe('bucket policy (docs/04-data/storage-strategy.md)', () => {
  it('gives body and try-on the shortest TTLs', () => {
    expect(BUCKETS.body.ttlSeconds).toBeLessThanOrEqual(BUCKETS.garments.ttlSeconds);
    expect(BUCKETS.tryon.ttlSeconds).toBeLessThanOrEqual(BUCKETS.garments.ttlSeconds);
  });

  it('keeps every TTL short', () => {
    for (const bucket of Object.values(BUCKETS)) {
      expect(bucket.ttlSeconds).toBeLessThanOrEqual(300);
    }
  });
});

describe('signed reads (SEC-4)', () => {
  const key = buildStorageKey('garments', ALICE, 'g1', 'original.jpg');

  it('issues an expiring URL', async () => {
    const signed = await storage.signedReadUrl(key, ALICE);
    expect(signed.url).toContain('signature=');
    expect(signed.url).toContain('expires=');
    expect(new Date(signed.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('verifies a signature it issued', async () => {
    const signed = await storage.signedReadUrl(key, ALICE);
    const url = new URL(signed.url);
    expect(
      storage.verify(
        key,
        ALICE,
        Number(url.searchParams.get('expires')),
        url.searchParams.get('signature') ?? '',
      ),
    ).toBe(true);
  });

  it('rejects a tampered signature', async () => {
    const signed = await storage.signedReadUrl(key, ALICE);
    const url = new URL(signed.url);
    expect(storage.verify(key, ALICE, Number(url.searchParams.get('expires')), 'forged')).toBe(
      false,
    );
  });

  it("rejects another user replaying a signature for someone else's key", async () => {
    const signed = await storage.signedReadUrl(key, ALICE);
    const url = new URL(signed.url);
    // Mallory presents Alice's signature for Alice's key, claiming to be herself.
    expect(
      storage.verify(
        key,
        MALLORY,
        Number(url.searchParams.get('expires')),
        url.searchParams.get('signature') ?? '',
      ),
    ).toBe(false);
  });

  it('rejects an expired signature', () => {
    const past = createLocalStorage({
      root,
      secret: 'test-secret',
      publicBaseUrl: 'http://localhost:4000/v1',
      now: () => Date.now(),
    });
    const expired = Math.floor(Date.now() / 1000) - 10;
    expect(past.verify(key, ALICE, expired, 'anything')).toBe(false);
  });

  it('rejects a signature for an unsafe key', () => {
    expect(storage.verify('../../etc/passwd', ALICE, Date.now() / 1000 + 60, 'x')).toBe(false);
  });
});

describe('object round-trip', () => {
  it('stores and reads bytes', async () => {
    const key = buildStorageKey('garments', ALICE, 'g2', 'x.png');
    await storage.put(key, Buffer.from('hello'));
    expect((await storage.get(key))?.toString()).toBe('hello');
  });

  it('returns null for a missing object rather than throwing', async () => {
    expect(await storage.get(buildStorageKey('garments', ALICE, 'nope', 'x.png'))).toBeNull();
  });

  it('deletes', async () => {
    const key = buildStorageKey('garments', ALICE, 'g3', 'x.png');
    await storage.put(key, Buffer.from('bye'));
    await storage.delete(key);
    expect(await storage.get(key)).toBeNull();
  });

  it('refuses to write outside its root', async () => {
    await expect(storage.put('../escape.txt', Buffer.from('x'))).rejects.toThrow();
  });
});

describe('signed uploads', () => {
  it('always places the key under the requesting user prefix', async () => {
    const result = await storage.signedUploadUrl('garments', ALICE, 'photo.jpg');
    expect(userOf(result.storageKey)).toBe(ALICE);
    expect(bucketOf(result.storageKey)).toBe('garments');
  });

  it('sanitizes the filename', async () => {
    const result = await storage.signedUploadUrl('garments', ALICE, '../../evil name.jpg');
    expect(result.storageKey).not.toContain('..');
    expect(isSafeStorageKey(result.storageKey)).toBe(true);
  });
});
