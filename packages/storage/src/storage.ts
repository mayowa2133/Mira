/**
 * Private object storage.
 *
 * Every user image in Mira is private. There is no public bucket
 * (`docs/04-data/storage-strategy.md`, SEC-4).
 *
 * Reads go through short-lived signed URLs issued only AFTER an ownership
 * check. The signature binds the key to the user, so a leaked URL for one
 * user cannot be replayed by another, and it expires.
 *
 * Phase 1 ships the local driver, which is what development and tests use. An
 * S3 driver lands when the infrastructure exists; the interface is the same, so
 * nothing above this layer changes.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, normalize, resolve, sep } from 'node:path';

/**
 * Buckets and their signed-URL lifetimes.
 *
 * Body and try-on objects carry the strictest rules and the shortest TTLs
 * (`docs/04-data/storage-strategy.md` §1).
 */
export const BUCKETS = {
  garments: { name: 'mira-garments', ttlSeconds: 300 },
  body: { name: 'mira-body', ttlSeconds: 120 },
  tryon: { name: 'mira-tryon', ttlSeconds: 120 },
  imports: { name: 'mira-imports', ttlSeconds: 300 },
} as const;

export type BucketName = keyof typeof BUCKETS;

export type SignedUrl = { url: string; expiresAt: string };

export interface StorageDriver {
  /**
   * Issue a short-lived read URL. The caller has ALREADY authorized ownership;
   * this binds the signature to that user so the URL cannot be replayed.
   */
  signedReadUrl(storageKey: string, userId: string): Promise<SignedUrl>;
  /** Issue a scoped upload target. The key always sits under the user's prefix. */
  signedUploadUrl(
    bucket: BucketName,
    userId: string,
    filename: string,
  ): Promise<{ uploadUrl: string; storageKey: string; expiresAt: string }>;
  put(storageKey: string, body: Buffer): Promise<void>;
  get(storageKey: string): Promise<Buffer | null>;
  /**
   * Is the object there?
   *
   * Separate from `get` because callers that only need presence — the photo
   * import, checking an upload actually landed — should not pull megabytes
   * through memory to find out.
   */
  exists(storageKey: string): Promise<boolean>;
  delete(storageKey: string): Promise<void>;
  verify(storageKey: string, userId: string, expires: number, signature: string): boolean;
}

/**
 * The `user_id` prefix makes bulk deletion for a privacy request a prefix
 * operation, and makes a misdirected write obvious
 * (`docs/04-data/storage-strategy.md` §2).
 */
export function buildStorageKey(bucket: BucketName, userId: string, ...parts: string[]): string {
  return [bucket, userId, ...parts].join('/');
}

export function bucketOf(storageKey: string): BucketName | null {
  const first = storageKey.split('/')[0];
  return first && first in BUCKETS ? (first as BucketName) : null;
}

/** The user id a key belongs to, used to reject cross-user access. */
export function userOf(storageKey: string): string | null {
  return storageKey.split('/')[1] ?? null;
}

/**
 * Reject traversal and absolute paths before a key ever touches the filesystem
 * or an object store.
 */
export function isSafeStorageKey(storageKey: string): boolean {
  if (!storageKey || storageKey.startsWith('/') || storageKey.includes('\0')) return false;
  if (storageKey.includes('..')) return false;
  if (normalize(storageKey) !== storageKey) return false;
  return bucketOf(storageKey) !== null && Boolean(userOf(storageKey));
}

function sign(secret: string, storageKey: string, userId: string, expires: number): string {
  return createHmac('sha256', secret)
    .update(`${storageKey}\n${userId}\n${expires}`)
    .digest('base64url');
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export type LocalStorageOptions = {
  root: string;
  secret: string;
  /** Base URL the API serves signed reads from. */
  publicBaseUrl: string;
  now?: () => number;
};

/**
 * Filesystem-backed driver for local development and tests.
 *
 * It reproduces the security properties that matter — private by default,
 * expiring signatures bound to a user, keys confined to a prefix — so the code
 * above it is exercised the same way it will be in production.
 */
export function createLocalStorage(options: LocalStorageOptions): StorageDriver {
  const now = options.now ?? (() => Date.now());
  const root = resolve(options.root);

  const pathFor = (storageKey: string): string => {
    if (!isSafeStorageKey(storageKey)) {
      throw new Error(`unsafe storage key: ${storageKey}`);
    }
    const full = resolve(join(root, storageKey));
    // Defence in depth: even with a safe-looking key, never escape the root.
    if (full !== root && !full.startsWith(root + sep)) {
      throw new Error(`storage key escapes the root: ${storageKey}`);
    }
    return full;
  };

  return {
    async signedReadUrl(storageKey, userId) {
      if (!isSafeStorageKey(storageKey)) throw new Error(`unsafe storage key: ${storageKey}`);

      const bucket = bucketOf(storageKey);
      if (!bucket) throw new Error(`unknown bucket for key: ${storageKey}`);

      const expires = Math.floor(now() / 1000) + BUCKETS[bucket].ttlSeconds;
      const signature = sign(options.secret, storageKey, userId, expires);
      const url =
        `${options.publicBaseUrl}/media/${encodeURI(storageKey)}` +
        `?expires=${expires}&signature=${signature}`;

      return { url, expiresAt: new Date(expires * 1000).toISOString() };
    },

    async signedUploadUrl(bucket, userId, filename) {
      // Collapse dot runs as well as illegal characters: replacing only the
      // separators would leave `..` intact, producing a key that `isSafeStorageKey`
      // then rejects — an upload target that can never be used.
      const safeName =
        filename
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .replace(/\.{2,}/g, '.')
          .replace(/^[._-]+/, '')
          .slice(0, 100) || 'upload';
      const storageKey = buildStorageKey(bucket, userId, `${Date.now()}-${safeName}`);
      const expires = Math.floor(now() / 1000) + BUCKETS[bucket].ttlSeconds;
      const signature = sign(options.secret, storageKey, userId, expires);

      return {
        uploadUrl:
          `${options.publicBaseUrl}/media/upload/${encodeURI(storageKey)}` +
          `?expires=${expires}&signature=${signature}`,
        storageKey,
        expiresAt: new Date(expires * 1000).toISOString(),
      };
    },

    async put(storageKey, body) {
      const path = pathFor(storageKey);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
    },

    async get(storageKey) {
      const path = pathFor(storageKey);
      if (!existsSync(path)) return null;
      return readFile(path);
    },

    async exists(storageKey) {
      // A traversal-unsafe key is treated as absent rather than resolved: it
      // must never be able to answer questions about the filesystem.
      if (!isSafeStorageKey(storageKey)) return false;
      return existsSync(pathFor(storageKey));
    },

    async delete(storageKey) {
      const path = pathFor(storageKey);
      if (existsSync(path)) await unlink(path);
    },

    verify(storageKey, userId, expires, signature) {
      if (!isSafeStorageKey(storageKey)) return false;
      // An expired signature is not a valid signature, however well-formed.
      if (expires * 1000 < now()) return false;
      // A signature for one user must never authorize another's key.
      if (userOf(storageKey) !== userId) return false;
      return constantTimeEquals(sign(options.secret, storageKey, userId, expires), signature);
    },
  };
}
