/**
 * Closet API integration tests.
 *
 * Runs the real HTTP stack against a REAL Postgres: routes, validation,
 * authorization, service, repository, SQL, constraints and RLS. A mock would
 * assert nothing about the parts most likely to be wrong
 * (`docs/08-engineering/testing-strategy.md` — Principles).
 *
 *   npm run db:up && npm run db:migrate && npm test
 *
 * Skips with a clear message when no database is reachable.
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
import { createLocalStorage } from '@mira/storage';

const SECRET = 'closet-integration-secret';
/**
 * A database of its own, never the development one.
 *
 * These tests write real rows and, in the worker's case, CLAIM QUEUED JOBS —
 * and job claiming is global by design. Run against the dev database with a
 * worker up, a test and the real worker race for the same job: whoever loses
 * sees it fail against the wrong storage root, which is exactly the
 * intermittent `unsupported_image_undecodable` that went unexplained twice.
 *
 *   npm run db:test:setup
 */
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

const storageRoot = mkdtempSync(join(tmpdir(), 'mira-closet-it-'));

let app: FastifyInstance | null = null;
let pool: pg.Pool | null = null;
let available = false;

const ALICE = 'closet-it-alice';
const MALLORY = 'closet-it-mallory';

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

beforeAll(async () => {
  process.env['DATABASE_URL'] = DATABASE_URL;
  const candidate = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
  try {
    const { rows } = await candidate.query<{ count: string }>(
      "select count(*) as count from information_schema.tables where table_name = 'garments'",
    );
    if (rows[0]?.count === '0') throw new Error('run `npm run db:migrate`');
    pool = candidate;
    available = true;
  } catch {
    await candidate.end().catch(() => undefined);
    available = false;
    return;
  }

  // Clean slate for the two test identities.
  await pool.query('delete from users where auth_provider_id = any($1::text[])', [
    [ALICE, MALLORY],
  ]);

  app = await buildServer({
    env: testEnv,
    verifier: createDevVerifier(testEnv),
    logger: createLogger({ level: 'fatal', sink: () => undefined }),
    checkDependencies: async () => ({ database: true, queue: true, storage: true }),
    storage: createLocalStorage({
      root: storageRoot,
      secret: 'test',
      publicBaseUrl: 'http://localhost:4000/v1',
    }),
  });

  // Establish both users and their closets.
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

const validGarment = {
  name: 'Satin Midi Dress',
  brand_raw: 'Zara',
  category: 'dresses',
  subcategory: 'midi_dress',
  primary_color: 'black',
  materials: ['polyester'],
  size_raw: 'S',
  size_normalized: 'S',
  size_system: 'alpha',
  season: ['summer'],
  occasion: ['dinner'],
  purchase_price: 79.9,
  currency: 'CAD',
  retailer: 'Zara',
};

/**
 * Distinct names, because these tests are not about duplicates.
 *
 * Every one of them used to post the identical "Zara Satin Midi Dress", which
 * duplicate detection now — correctly — stops to ask about (CAP-5). Naming each
 * garment separately keeps the signal that fires down to "same brand, colour
 * and size", which is the `note` band: recorded, never an interruption.
 */
let nextGarment = 0;

async function createGarment(subject: string, overrides: Record<string, unknown> = {}) {
  nextGarment += 1;
  const res = await app!.inject({
    method: 'POST',
    url: '/v1/garments',
    headers: await auth(subject),
    payload: { ...validGarment, name: `Satin Midi Dress ${nextGarment}`, ...overrides },
  });
  return res;
}

describe('POST /garments', () => {
  dbIt('creates a garment and returns it serialized', async () => {
    const res = await createGarment(ALICE);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.category).toBe('dresses');
    expect(body.subcategory).toBe('midi_dress');
    expect(body.primary_color).toBe('black');
    expect(body.status).toBe('active');
    expect(body.purchase.price).toEqual({ amount: 79.9, currency: 'CAD' });
  });

  dbIt('records immutable provenance (CAP-3)', async () => {
    const res = await createGarment(ALICE, { source_type: 'camera' });
    expect(res.json().source.type).toBe('camera');

    const { rows } = await pool!.query(
      'select source_type from garment_sources where garment_id = $1',
      [res.json().id],
    );
    expect(rows).toHaveLength(1);
  });

  dbIt('requires an Idempotency-Key', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/garments',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
      payload: validGarment,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('missing_idempotency_key');
  });

  dbIt('rejects a category outside the taxonomy (INV-1)', async () => {
    const res = await createGarment(ALICE, { category: 'outfits' });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('not_in_taxonomy');
  });

  dbIt('rejects a subcategory that belongs to another category', async () => {
    const res = await createGarment(ALICE, { category: 'dresses', subcategory: 'heels' });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('subcategory_mismatch');
  });

  dbIt('resolves a brand into the global brands table', async () => {
    const res = await createGarment(ALICE, { brand_raw: 'Aritzia' });
    expect(res.json().brand?.name).toBe('Aritzia');
  });

  dbIt('keeps an unrecognized brand as brand_raw rather than failing (CAP-4)', async () => {
    const res = await createGarment(ALICE, { brand_raw: 'that little shop in lisbon' });
    expect(res.statusCode).toBe(201);
    expect(res.json().brand_raw).toBe('that little shop in lisbon');
  });

  dbIt('requires authentication', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/garments',
      headers: { 'idempotency-key': 'x' },
      payload: validGarment,
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /garments', () => {
  dbIt('lists only the caller garments', async () => {
    await createGarment(MALLORY, { name: 'Mallory dress' });

    const res = await app!.inject({
      method: 'GET',
      url: '/v1/garments?limit=100',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });

    expect(res.statusCode).toBe(200);
    const names: string[] = res.json().data.map((g: { name: string }) => g.name);
    expect(names).not.toContain('Mallory dress');
  });

  dbIt('filters by category', async () => {
    const res = await app!.inject({
      method: 'GET',
      url: '/v1/garments?category=dresses&limit=100',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });
    const categories: string[] = res.json().data.map((g: { category: string }) => g.category);
    expect(new Set(categories)).toEqual(new Set(['dresses']));
  });

  dbIt('rejects an out-of-taxonomy filter with 422 rather than returning nothing', async () => {
    const res = await app!.inject({
      method: 'GET',
      url: '/v1/garments?color=chartreuse',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('not_in_taxonomy');
  });

  dbIt('paginates with a stable cursor and never repeats a row', async () => {
    for (let i = 0; i < 5; i += 1) await createGarment(ALICE, { name: `Page test ${i}` });

    const seen = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;

    do {
      const url: string = `/v1/garments?limit=3${cursor ? `&cursor=${cursor}` : ''}`;
      const res = await app!.inject({
        method: 'GET',
        url,
        headers: { authorization: `Bearer ${await token(ALICE)}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      for (const g of body.data as { id: string }[]) {
        expect(seen.has(g.id), `row ${g.id} repeated across pages`).toBe(false);
        seen.add(g.id);
      }
      cursor = body.next_cursor;
      pages += 1;
    } while (cursor && pages < 20);

    expect(pages).toBeGreaterThan(1);
    expect(seen.size).toBeGreaterThan(3);
  });

  dbIt('excludes archived garments unless asked', async () => {
    const created = await createGarment(ALICE, { name: 'To archive' });
    const id = created.json().id;

    await app!.inject({
      method: 'POST',
      url: `/v1/garments/${id}/status`,
      headers: await auth(ALICE),
      payload: { status: 'archived' },
    });

    const listed = await app!.inject({
      method: 'GET',
      url: '/v1/garments?limit=100',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });
    const ids: string[] = listed.json().data.map((g: { id: string }) => g.id);
    expect(ids).not.toContain(id);

    const explicit = await app!.inject({
      method: 'GET',
      url: '/v1/garments?status=archived&limit=100',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });
    expect(explicit.json().data.map((g: { id: string }) => g.id)).toContain(id);
  });
});

/**
 * Pagination completeness.
 *
 * Two bugs lived here, both invisible on a small closet:
 *
 * 1. The cursor round-tripped a timestamptz through a JS Date, truncating
 *    Postgres microseconds to milliseconds. Rows inside the lost window were
 *    silently SKIPPED — 2 of 223 on the seeded closet.
 * 2. `count` did not apply the same default visibility as `list`, so the filter
 *    sheet's "Show N items" CTA promised more than the grid delivered.
 *
 * Walking every page and comparing against `count` catches both.
 */
describe('pagination completeness', () => {
  dbIt('returns every matching garment exactly once, at any page size', async () => {
    // Enough rows that several page sizes produce multiple pages.
    for (let i = 0; i < 12; i += 1) await createGarment(ALICE, { name: `Complete ${i}` });

    const bearer = { authorization: `Bearer ${await token(ALICE)}` };
    const countRes = await app!.inject({
      method: 'GET',
      url: '/v1/garments/count',
      headers: bearer,
    });
    const expected: number = countRes.json().count;

    for (const limit of [3, 5, 40]) {
      const seen = new Set<string>();
      let cursor: string | null = null;
      let pages = 0;

      do {
        const url: string = `/v1/garments?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`;
        const res = await app!.inject({ method: 'GET', url, headers: bearer });
        const body = res.json();
        for (const g of body.data as { id: string }[]) {
          expect(seen.has(g.id), `row ${g.id} repeated at limit=${limit}`).toBe(false);
          seen.add(g.id);
        }
        cursor = body.next_cursor;
        pages += 1;
      } while (cursor && pages < 200);

      // No row may be dropped, and none repeated, whatever the page size.
      expect(seen.size, `dropped rows at limit=${limit}`).toBe(expected);
    }
  });

  dbIt('keeps count and list in agreement for the same filters', async () => {
    const bearer = { authorization: `Bearer ${await token(ALICE)}` };

    for (const qs of ['', 'category=dresses&', 'never_worn=true&', 'favorite=true&']) {
      const counted: number = (
        await app!.inject({ method: 'GET', url: `/v1/garments/count?${qs}`, headers: bearer })
      ).json().count;

      const seen = new Set<string>();
      let cursor: string | null = null;
      let pages = 0;
      do {
        const url: string = `/v1/garments?${qs}limit=25${cursor ? `&cursor=${cursor}` : ''}`;
        const body = (await app!.inject({ method: 'GET', url, headers: bearer })).json();
        for (const g of body.data as { id: string }[]) seen.add(g.id);
        cursor = body.next_cursor;
        pages += 1;
      } while (cursor && pages < 200);

      expect(seen.size, `count/list disagree for "${qs || 'no filter'}"`).toBe(counted);
    }
  });

  dbIt('excludes archived from both count and list by default', async () => {
    const bearer = { authorization: `Bearer ${await token(ALICE)}` };
    const before: number = (
      await app!.inject({ method: 'GET', url: '/v1/garments/count', headers: bearer })
    ).json().count;

    const created = await createGarment(ALICE, { name: 'Archive me' });
    await app!.inject({
      method: 'POST',
      url: `/v1/garments/${created.json().id}/status`,
      headers: await auth(ALICE),
      payload: { status: 'archived' },
    });

    const after: number = (
      await app!.inject({ method: 'GET', url: '/v1/garments/count', headers: bearer })
    ).json().count;

    // Created one, then archived it: the visible count is unchanged.
    expect(after).toBe(before);
  });
});

describe('GET /garments/count — powers the filter sheet CTA', () => {
  dbIt('returns a count for the same filters as the list', async () => {
    const res = await app!.inject({
      method: 'GET',
      url: '/v1/garments/count?category=dresses',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json().count).toBe('number');
  });
});

/**
 * THE 404 RULE — a garment that exists but belongs to another user is
 * INVISIBLE, so every route returns 404 rather than 403 (SEC-5).
 */
describe('cross-user access (SEC-5)', () => {
  dbIt('returns 404, not 403, for every garment route', async () => {
    const created = await createGarment(ALICE, { name: 'Alice private' });
    const id = created.json().id;
    const mallory = { authorization: `Bearer ${await token(MALLORY)}` };

    const attempts = [
      app!.inject({ method: 'GET', url: `/v1/garments/${id}`, headers: mallory }),
      app!.inject({
        method: 'PATCH',
        url: `/v1/garments/${id}`,
        headers: mallory,
        payload: { name: 'stolen' },
      }),
      app!.inject({ method: 'DELETE', url: `/v1/garments/${id}`, headers: mallory }),
      app!.inject({
        method: 'POST',
        url: `/v1/garments/${id}/favorite`,
        headers: mallory,
        payload: { favorite: true },
      }),
      app!.inject({
        method: 'POST',
        url: `/v1/garments/${id}/status`,
        headers: mallory,
        payload: { status: 'laundry' },
      }),
    ];

    for (const res of await Promise.all(attempts)) {
      expect(res.statusCode).toBe(404);
      expect(res.statusCode).not.toBe(403);
    }

    // And Alice's garment is untouched.
    const stillHers = await app!.inject({
      method: 'GET',
      url: `/v1/garments/${id}`,
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });
    expect(stillHers.json().name).toBe('Alice private');
  });
});

describe('PATCH /garments/:id', () => {
  dbIt('updates mutable fields', async () => {
    const created = await createGarment(ALICE);
    const res = await app!.inject({
      method: 'PATCH',
      url: `/v1/garments/${created.json().id}`,
      headers: await auth(ALICE),
      payload: { name: 'Renamed', notes: 'A note' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Renamed');
  });

  dbIt('refuses to rewrite provenance (CAP-3)', async () => {
    const created = await createGarment(ALICE);
    const res = await app!.inject({
      method: 'PATCH',
      url: `/v1/garments/${created.json().id}`,
      headers: await auth(ALICE),
      payload: { source_type: 'manual' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('immutable_field');
  });
});

describe('status and favourite', () => {
  dbIt('sets a user-settable status', async () => {
    const created = await createGarment(ALICE);
    const res = await app!.inject({
      method: 'POST',
      url: `/v1/garments/${created.json().id}/status`,
      headers: await auth(ALICE),
      payload: { status: 'laundry' },
    });
    expect(res.json().status).toBe('laundry');
  });

  dbIt('refuses a status owned by another flow', async () => {
    const created = await createGarment(ALICE);
    const res = await app!.inject({
      method: 'POST',
      url: `/v1/garments/${created.json().id}/status`,
      headers: await auth(ALICE),
      payload: { status: 'sold' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('invalid_status_transition');
  });

  dbIt('toggles favourite', async () => {
    const created = await createGarment(ALICE);
    const res = await app!.inject({
      method: 'POST',
      url: `/v1/garments/${created.json().id}/favorite`,
      headers: await auth(ALICE),
      payload: { favorite: true },
    });
    expect(res.json().favorite).toBe(true);
  });
});

describe('DELETE and restore — soft delete with undo', () => {
  dbIt('soft-deletes, hides, and restores', async () => {
    const created = await createGarment(ALICE, { name: 'Temporary' });
    const id = created.json().id;
    const bearer = { authorization: `Bearer ${await token(ALICE)}` };

    const removed = await app!.inject({
      method: 'DELETE',
      url: `/v1/garments/${id}`,
      headers: bearer,
    });
    expect(removed.statusCode).toBe(204);

    const gone = await app!.inject({ method: 'GET', url: `/v1/garments/${id}`, headers: bearer });
    expect(gone.statusCode).toBe(404);

    // The row survives for the undo window.
    const { rows } = await pool!.query('select deleted_at from garments where id = $1', [id]);
    expect(rows[0]?.deleted_at).not.toBeNull();

    const restored = await app!.inject({
      method: 'POST',
      url: `/v1/garments/${id}/restore`,
      headers: await auth(ALICE),
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json().name).toBe('Temporary');
  });
});

describe('GET /closet', () => {
  dbIt('summarizes counts by category and recent additions', async () => {
    const res = await app!.inject({
      method: 'GET',
      url: '/v1/closet',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.total).toBe('number');
    expect(Array.isArray(body.by_category)).toBe(true);
    expect(Array.isArray(body.recently_added)).toBe(true);
  });
});

describe('cost per wear', () => {
  dbIt('is null without a wear, and computed once worn', async () => {
    const created = await createGarment(ALICE, { purchase_price: 100, currency: 'CAD' });
    expect(created.json().wear.cost_per_wear).toBeNull();

    await pool!.query('update garments set worn_count = 4 where id = $1', [created.json().id]);

    const res = await app!.inject({
      method: 'GET',
      url: `/v1/garments/${created.json().id}`,
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });
    expect(res.json().wear.cost_per_wear).toEqual({ amount: 25, currency: 'CAD' });
  });
});
