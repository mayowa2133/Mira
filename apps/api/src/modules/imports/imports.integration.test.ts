/**
 * Photo import integration tests.
 *
 * Real HTTP stack against a REAL Postgres: routes, validation, authorization,
 * service, repository, SQL and constraints. The behaviour under test —
 * "the garment exists before analysis completes" — is the whole point of the
 * endpoint, and a mocked repository would assert none of it.
 *
 *   npm run db:up && npm run db:migrate && npm test
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SignJWT } from 'jose';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../http/server.js';
import { loadEnv } from '../../config/env.js';
import { createDevVerifier } from '../identity/verify.js';
import { createLogger } from '../../lib/logger.js';
import { buildStorageKey, createLocalStorage, type StorageDriver } from '@mira/storage';
import type { JobEnqueuer } from './service.js';

const SECRET = 'imports-integration-secret';
const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://mira:mira@localhost:5433/mira';

const testEnv = loadEnv({
  NODE_ENV: 'test',
  MIRA_ENV: 'local',
  LOG_LEVEL: 'fatal',
  DEV_AUTH_SECRET: SECRET,
  JWT_AUDIENCE: 'mira',
  DATABASE_URL,
} as NodeJS.ProcessEnv);

const storageRoot = mkdtempSync(join(tmpdir(), 'mira-imports-it-'));

let app: FastifyInstance | null = null;
let pool: pg.Pool | null = null;
let storage: StorageDriver | null = null;
let available = false;

const enqueued: { type: string; userId: string; payload: unknown }[] = [];
const queue: JobEnqueuer = {
  async enqueue(job) {
    enqueued.push({ type: job.type, userId: job.userId, payload: job.payload });
  },
};

const ALICE = 'imports-it-alice';
const MALLORY = 'imports-it-mallory';

async function token(subject: string): Promise<string> {
  return new SignJWT({ email: `${subject}@mira.local` })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setAudience('mira')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));
}

async function auth(subject: string) {
  return {
    authorization: `Bearer ${await token(subject)}`,
    'idempotency-key': crypto.randomUUID(),
  };
}

/** Mira's own user id, which is NOT the auth provider subject. */
async function userIdOf(subject: string): Promise<string> {
  const { rows } = await pool!.query<{ id: string }>(
    'select id from users where auth_provider_id = $1',
    [subject],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error(`no user for ${subject}`);
  return id;
}

/** Put a real object in the user's garment prefix and return its key. */
async function uploadedPhoto(subject: string, name = 'original.jpg'): Promise<string> {
  const userId = await userIdOf(subject);
  const key = buildStorageKey('garments', userId, crypto.randomUUID(), name);
  await storage!.put(key, Buffer.from('not really a jpeg, but present'));
  return key;
}

beforeAll(async () => {
  process.env['DATABASE_URL'] = DATABASE_URL;
  const candidate = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
  try {
    const { rows } = await candidate.query<{ count: string }>(
      "select count(*) as count from information_schema.tables where table_name = 'ingestion_jobs'",
    );
    if (rows[0]?.count === '0') throw new Error('run `npm run db:migrate`');
    pool = candidate;
    available = true;
  } catch {
    await candidate.end().catch(() => undefined);
    available = false;
    return;
  }

  await pool.query('delete from users where auth_provider_id = any($1::text[])', [
    [ALICE, MALLORY],
  ]);

  storage = createLocalStorage({
    root: storageRoot,
    secret: 'test',
    publicBaseUrl: 'http://localhost:4000/v1',
  });

  app = await buildServer({
    env: testEnv,
    verifier: createDevVerifier(testEnv),
    logger: createLogger({ level: 'fatal', sink: () => undefined }),
    checkDependencies: async () => ({ database: true, queue: true, storage: true }),
    storage,
    queue,
  });

  for (const subject of [ALICE, MALLORY]) {
    await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${await token(subject)}` },
    });
  }
});

afterAll(async () => {
  await app?.close();
  await pool
    ?.query('delete from users where auth_provider_id = any($1::text[])', [[ALICE, MALLORY]])
    .catch(() => undefined);
  await pool?.end();
  rmSync(storageRoot, { recursive: true, force: true });
});

const dbIt = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!available || !app) {
      console.warn(`skipping "${name}": no migrated database at ${DATABASE_URL}`);
      return;
    }
    await fn();
  });

describe('POST /imports/photo', () => {
  dbIt('creates a visible garment before any processing happens', async () => {
    const key = await uploadedPhoto(ALICE);

    const response = await app!.inject({
      method: 'POST',
      url: '/v1/imports/photo',
      headers: await auth(ALICE),
      payload: { upload_key: key },
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    expect(body.garment_id).toBeTruthy();
    expect(body.job_id).toBeTruthy();

    // The whole invariant: it is in the closet NOW, not after the worker runs.
    const list = await app!.inject({
      method: 'GET',
      url: '/v1/garments',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });
    const ids = list.json().data.map((g: { id: string }) => g.id);
    expect(ids).toContain(body.garment_id);
  });

  dbIt('marks the garment analyzing, with the original already canonical', async () => {
    const key = await uploadedPhoto(ALICE);
    const created = await app!.inject({
      method: 'POST',
      url: '/v1/imports/photo',
      headers: await auth(ALICE),
      payload: { upload_key: key },
    });

    const detail = await app!.inject({
      method: 'GET',
      url: `/v1/garments/${created.json().garment_id}`,
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });

    const garment = detail.json();
    expect(garment.analysis_state).toBe('analyzing');
    // `other` is a real taxonomy member, not an invented placeholder.
    expect(garment.category).toBe('other');
    expect(garment.source).toMatchObject({ type: 'camera', reference: key });
    // An image from the first render, so the tile is never a blank frame.
    expect(garment.canonical_image?.url).toBeTruthy();
  });

  dbIt('records provenance and an ingestion job', async () => {
    const key = await uploadedPhoto(ALICE);
    const created = await app!.inject({
      method: 'POST',
      url: '/v1/imports/photo',
      headers: await auth(ALICE),
      payload: { upload_key: key },
    });
    const { garment_id, job_id } = created.json();

    const sources = await pool!.query(
      'select source_type, reference_id from garment_sources where garment_id = $1',
      [garment_id],
    );
    expect(sources.rows[0]).toMatchObject({ source_type: 'camera', reference_id: key });

    const job = await app!.inject({
      method: 'GET',
      url: `/v1/imports/${job_id}`,
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });
    expect(job.json()).toMatchObject({ job_type: 'image.process', status: 'queued' });
  });

  dbIt('enqueues image.process for the created image', async () => {
    enqueued.length = 0;
    const key = await uploadedPhoto(ALICE);
    const created = await app!.inject({
      method: 'POST',
      url: '/v1/imports/photo',
      headers: await auth(ALICE),
      payload: { upload_key: key },
    });

    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]).toMatchObject({
      type: 'image.process',
      payload: { garmentImageId: created.json().garment_image_id, uploadKey: key },
    });
  });

  dbIt('accepts photo_library as a source', async () => {
    const key = await uploadedPhoto(ALICE);
    const created = await app!.inject({
      method: 'POST',
      url: '/v1/imports/photo',
      headers: await auth(ALICE),
      payload: { upload_key: key, source: 'photo_library' },
    });

    const detail = await app!.inject({
      method: 'GET',
      url: `/v1/garments/${created.json().garment_id}`,
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });
    expect(detail.json().source.type).toBe('photo_library');
  });

  describe('rejections', () => {
    dbIt('requires an Idempotency-Key', async () => {
      const key = await uploadedPhoto(ALICE);
      const response = await app!.inject({
        method: 'POST',
        url: '/v1/imports/photo',
        headers: { authorization: `Bearer ${await token(ALICE)}` },
        payload: { upload_key: key },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('missing_idempotency_key');
    });

    dbIt('refuses an upload key belonging to another user', async () => {
      // Mallory's own object, imported by Alice: the IDOR surface.
      const mallorysKey = await uploadedPhoto(MALLORY);

      const response = await app!.inject({
        method: 'POST',
        url: '/v1/imports/photo',
        headers: await auth(ALICE),
        payload: { upload_key: mallorysKey },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('upload_key_invalid');
      // And nothing was created for either party.
      const { rows } = await pool!.query(
        'select count(*) as count from garments where source_reference = $1',
        [mallorysKey],
      );
      expect(rows[0].count).toBe('0');
    });

    dbIt('refuses a traversing upload key', async () => {
      const response = await app!.inject({
        method: 'POST',
        url: '/v1/imports/photo',
        headers: await auth(ALICE),
        payload: { upload_key: 'garments/../../etc/passwd' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('upload_key_invalid');
    });

    dbIt('refuses a key in the wrong bucket', async () => {
      const userId = await userIdOf(ALICE);
      const bodyKey = buildStorageKey('body', userId, 'shot.jpg');
      await storage!.put(bodyKey, Buffer.from('body image'));

      const response = await app!.inject({
        method: 'POST',
        url: '/v1/imports/photo',
        headers: await auth(ALICE),
        payload: { upload_key: bodyKey },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('upload_key_invalid');
    });

    dbIt('refuses a key whose object never arrived', async () => {
      const userId = await userIdOf(ALICE);
      const missing = buildStorageKey('garments', userId, 'never', 'uploaded.jpg');

      const response = await app!.inject({
        method: 'POST',
        url: '/v1/imports/photo',
        headers: await auth(ALICE),
        payload: { upload_key: missing },
      });

      // 409, not 400: the request is well-formed, the upload just is not done.
      expect(response.statusCode).toBe(409);
    });
  });
});

describe('PUT /media/upload/* — the actual bytes', () => {
  /**
   * This is the step that turns a signed target into a stored photograph, and
   * it was broken from Phase 1 until Phase 2 without anything noticing.
   *
   * Fastify parses JSON and urlencoded and rejects every other content type, so
   * `image/jpeg` never reached the handler: the `Buffer.isBuffer(request.body)`
   * check inside it was unreachable code. Nothing caught it because the seed
   * writes to storage directly and the UI tests never uploaded.
   */
  dbIt('accepts image bytes and stores them verbatim', async () => {
    const userId = await userIdOf(ALICE);
    const key = buildStorageKey('garments', userId, crypto.randomUUID(), 'photo.jpg');

    const signed = await storage!.signedUploadUrl('garments', userId, 'photo.jpg');
    const url = new URL(signed.uploadUrl);

    // A JPEG's opening bytes; the point is that it is not JSON.
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

    const response = await app!.inject({
      method: 'PUT',
      url: `${url.pathname}${url.search}`,
      headers: { 'content-type': 'image/jpeg' },
      payload: bytes,
    });

    expect(response.statusCode).toBe(204);

    const stored = await storage!.get(signed.storageKey);
    expect(stored).not.toBeNull();
    expect(Buffer.compare(stored as Buffer, bytes)).toBe(0);
    void key;
  });

  dbIt('rejects a body it cannot treat as an image', async () => {
    const userId = await userIdOf(ALICE);
    const signed = await storage!.signedUploadUrl('garments', userId, 'photo.jpg');
    const url = new URL(signed.uploadUrl);

    const response = await app!.inject({
      method: 'PUT',
      url: `${url.pathname}${url.search}`,
      headers: { 'content-type': 'text/plain' },
      payload: 'definitely not a photograph',
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(await storage!.exists(signed.storageKey)).toBe(false);
  });
});

describe('GET /imports/:id', () => {
  dbIt("404s on another user's job rather than 403", async () => {
    const key = await uploadedPhoto(ALICE);
    const created = await app!.inject({
      method: 'POST',
      url: '/v1/imports/photo',
      headers: await auth(ALICE),
      payload: { upload_key: key },
    });

    const response = await app!.inject({
      method: 'GET',
      url: `/v1/imports/${created.json().job_id}`,
      headers: { authorization: `Bearer ${await token(MALLORY)}` },
    });

    // 403 would confirm the job exists.
    expect(response.statusCode).toBe(404);
  });
});
