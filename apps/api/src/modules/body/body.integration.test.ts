/**
 * Body profile (tasks 10.1, 10.7).
 *
 * Against a real Postgres and a real filesystem, because what is being tested
 * is that the OBJECT goes, not only the row — and a mocked storage driver
 * would assert that a method was called rather than that a file is gone.
 */
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SignJWT } from 'jose';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildStorageKey, createLocalStorage } from '@mira/storage';
import { buildServer } from '../../http/server.js';
import { loadEnv } from '../../config/env.js';
import { createDevVerifier } from '../identity/verify.js';
import { createLogger } from '../../lib/logger.js';
import { checkTestDatabase } from '../../test/database.js';

const SECRET = 'body-integration-secret';
const DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ?? 'postgresql://mira:mira@localhost:5433/mira_test';

const testEnv = loadEnv({
  NODE_ENV: 'test',
  MIRA_ENV: 'local',
  LOG_LEVEL: 'fatal',
  DEV_AUTH_SECRET: SECRET,
  JWT_AUDIENCE: 'mira',
  DATABASE_URL,
} as NodeJS.ProcessEnv);

const storageRoot = mkdtempSync(join(tmpdir(), 'mira-body-it-'));
const storage = createLocalStorage({
  root: storageRoot,
  secret: 'test',
  publicBaseUrl: 'http://localhost:4000/v1',
});

let app: FastifyInstance | null = null;
let pool: pg.Pool | null = null;
let available = false;
let aliceId = '';

const ALICE = 'body-it-alice';
const MALLORY = 'body-it-mallory';

async function token(subject: string): Promise<string> {
  return new SignJWT({ email: `${subject}@mira.local` })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setAudience('mira')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));
}
const auth = async (s: string) => ({ authorization: `Bearer ${await token(s)}` });

beforeAll(async () => {
  process.env['DATABASE_URL'] = DATABASE_URL;
  const candidate = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
  const status = await checkTestDatabase(candidate, 'body_profiles');
  if (!status.available) {
    await candidate.end().catch(() => undefined);
    available = false;
    return;
  }
  pool = candidate;
  available = true;

  await pool.query('delete from users where auth_provider_id = any($1::text[])', [
    [ALICE, MALLORY],
  ]);

  app = await buildServer({
    env: testEnv,
    verifier: createDevVerifier(testEnv),
    logger: createLogger({ level: 'fatal', sink: () => undefined }),
    checkDependencies: async () => ({ database: true, queue: true, storage: true }),
    storage,
  });

  for (const subject of [ALICE, MALLORY]) {
    await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${await token(subject)}` },
    });
  }
  const { rows } = await pool.query<{ id: string }>(
    'select id from users where auth_provider_id = $1',
    [ALICE],
  );
  aliceId = rows[0]!.id;
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
      console.warn(`skipping "${name}"`);
      return;
    }
    await fn();
  });

let n = 0;
/** An uploaded body photo, on disk and attached. */
async function addImage(subject: string, userId: string, kind = 'front') {
  n += 1;
  const key = buildStorageKey('body', userId, `photo-${n}.jpg`);
  await storage.put(key, Buffer.from('not really a photo'));

  const res = await app!.inject({
    method: 'POST',
    url: '/v1/body-profile/images',
    headers: await auth(subject),
    payload: { upload_key: key, kind },
  });
  return { key, id: res.json().data?.id as string | undefined, status: res.statusCode };
}

describe('the strictest surface in the system', () => {
  dbIt('has no profile until one is made, and says so plainly', async () => {
    const res = await app!.inject({
      method: 'GET',
      url: '/v1/body-profile',
      headers: await auth(ALICE),
    });
    // Absent is a real answer, not an error: most users have none.
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toBeNull();
  });

  dbIt('signs body images far shorter than garment images', async () => {
    await addImage(ALICE, aliceId);
    const res = await app!.inject({
      method: 'GET',
      url: '/v1/body-profile',
      headers: await auth(ALICE),
    });

    const expires = new Date(res.json().data.images[0].url_expires_at).getTime();
    const seconds = (expires - Date.now()) / 1000;
    // 120s, not garments' 300. A leaked body-image URL is a different order
    // of harm, and the window is the mitigation.
    expect(seconds).toBeLessThanOrEqual(130);
  });

  dbIt('refuses an upload key from another bucket', async () => {
    const key = buildStorageKey('garments', aliceId, 'not-a-body-photo.jpg');
    await storage.put(key, Buffer.from('x'));

    const res = await app!.inject({
      method: 'POST',
      url: '/v1/body-profile/images',
      headers: await auth(ALICE),
      payload: { upload_key: key, kind: 'front' },
    });
    expect(res.statusCode).toBe(422);
  });

  dbIt('refuses another user’s key, however well-formed', async () => {
    const { rows } = await pool!.query<{ id: string }>(
      'select id from users where auth_provider_id = $1',
      [MALLORY],
    );
    const key = buildStorageKey('body', rows[0]!.id, 'mallory.jpg');
    await storage.put(key, Buffer.from('x'));

    const res = await app!.inject({
      method: 'POST',
      url: '/v1/body-profile/images',
      headers: await auth(ALICE),
      payload: { upload_key: key, kind: 'front' },
    });
    // The key's own prefix says who it belongs to; trusting the request
    // instead is the whole IDOR surface of an upload.
    expect(res.statusCode).toBe(422);
  });
});

describe('deletion is hard and immediate (10.7)', () => {
  dbIt('deletes the object, not only the row', async () => {
    const { key, id } = await addImage(ALICE, aliceId);
    expect(existsSync(join(storageRoot, key))).toBe(true);

    const res = await app!.inject({
      method: 'DELETE',
      url: `/v1/body-profile/images/${id}`,
      headers: await auth(ALICE),
    });
    expect(res.statusCode).toBe(204);

    // A row deleted while the file survives is the worst outcome on this table.
    expect(existsSync(join(storageRoot, key))).toBe(false);

    const { rows } = await pool!.query('select 1 from body_profile_images where id = $1', [id]);
    expect(rows).toHaveLength(0);
  });

  dbIt('has no recycle bin — there is no soft delete to fall into', async () => {
    // data-retention.md: a user deleting a photograph of their own body must
    // not be told it is in a recycle bin for a month. A `deleted_at` column
    // would be an invitation to add one.
    const { rows } = await pool!.query(
      `select column_name from information_schema.columns
        where table_name = 'body_profile_images' and column_name = 'deleted_at'`,
    );
    expect(rows).toHaveLength(0);
  });

  dbIt('deleting the profile takes every object with it', async () => {
    const a = await addImage(ALICE, aliceId, 'front');
    const b = await addImage(ALICE, aliceId, 'side');

    const res = await app!.inject({
      method: 'DELETE',
      url: '/v1/body-profile',
      headers: await auth(ALICE),
    });
    expect(res.statusCode).toBe(204);

    for (const image of [a, b]) {
      expect(existsSync(join(storageRoot, image.key))).toBe(false);
    }
    const { rows } = await pool!.query('select 1 from body_profiles where user_id = $1', [aliceId]);
    expect(rows).toHaveLength(0);
  });

  dbIt('sweeps an orphan whose row was lost earlier', async () => {
    // An interrupted upload leaves a file with no row. The prefix delete is
    // what stops it outliving the profile it belonged to.
    const orphan = buildStorageKey('body', aliceId, 'interrupted.jpg');
    await storage.put(orphan, Buffer.from('x'));
    await addImage(ALICE, aliceId);

    await app!.inject({ method: 'DELETE', url: '/v1/body-profile', headers: await auth(ALICE) });
    expect(existsSync(join(storageRoot, orphan))).toBe(false);
  });

  dbIt('404s on another user’s image, never 403', async () => {
    const { rows } = await pool!.query<{ id: string }>(
      'select id from users where auth_provider_id = $1',
      [MALLORY],
    );
    const mallorys = await addImage(MALLORY, rows[0]!.id);

    const res = await app!.inject({
      method: 'DELETE',
      url: `/v1/body-profile/images/${mallorys.id}`,
      headers: await auth(ALICE),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('the profile itself', () => {
  dbIt('refuses an implausible height rather than storing it', async () => {
    const res = await app!.inject({
      method: 'PUT',
      url: '/v1/body-profile',
      headers: await auth(ALICE),
      payload: { height_cm: 900 },
    });
    expect(res.statusCode).toBe(422);
  });

  dbIt('keeps one active profile per user', async () => {
    await app!.inject({
      method: 'PUT',
      url: '/v1/body-profile',
      headers: await auth(ALICE),
      payload: { height_cm: 170 },
    });
    await app!.inject({
      method: 'PUT',
      url: '/v1/body-profile',
      headers: await auth(ALICE),
      payload: { height_cm: 171 },
    });

    // Two would make "which body" a question every try-on had to answer.
    const { rows } = await pool!.query(
      'select count(*) as n from body_profiles where user_id = $1 and is_active',
      [aliceId],
    );
    expect(Number(rows[0].n)).toBe(1);
  });
});
