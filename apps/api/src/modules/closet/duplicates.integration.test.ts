/**
 * Duplicate detection, end to end
 * (`docs/06-ai/duplicate-detection.md`, CAP-5).
 *
 * Against a REAL Postgres, because the parts most likely to be wrong are the
 * candidate query, the `garment_a_id < garment_b_id` constraint and the RLS
 * boundary — none of which a mock would exercise.
 *
 *   npm run db:test:setup && npm test
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

const SECRET = 'duplicates-integration-secret';
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

const storageRoot = mkdtempSync(join(tmpdir(), 'mira-dup-it-'));

let app: FastifyInstance | null = null;
let pool: pg.Pool | null = null;
let available = false;

const ALICE = 'dup-it-alice';
const MALLORY = 'dup-it-mallory';

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
      "select count(*) as count from information_schema.tables where table_name = 'garment_duplicates'",
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

/** The pair `duplicate-detection.md` §4 puts in the sheet. */
const BODYSUIT = {
  name: 'Contour Bodysuit',
  brand_raw: 'Aritzia',
  category: 'tops',
  primary_color: 'black',
  size_raw: 'S',
};

async function post(subject: string, payload: Record<string, unknown>) {
  return app!.inject({
    method: 'POST',
    url: '/v1/garments',
    headers: await auth(subject),
    payload,
  });
}

async function check(subject: string, payload: Record<string, unknown>) {
  return app!.inject({
    method: 'POST',
    url: '/v1/garments/check-duplicate',
    headers: await auth(subject),
    payload,
  });
}

/** A garment nothing else in these tests can match. */
function unique(overrides: Record<string, unknown> = {}) {
  const tag = crypto.randomUUID().slice(0, 8);
  return { ...BODYSUIT, name: `Piece ${tag}`, brand_raw: `Brand ${tag}`, ...overrides };
}

describe('POST /garments/check-duplicate', () => {
  dbIt('finds nothing in an unrelated closet', async () => {
    const res = await check(ALICE, unique());
    expect(res.statusCode).toBe(200);
    expect(res.json().candidates).toEqual([]);
  });

  dbIt('reports the quiet band without anything having to interrupt', async () => {
    const base = unique();
    await post(ALICE, base);

    // Same brand, colour and size — a different cut. §7's hard case: recorded,
    // never a question.
    const res = await check(ALICE, { ...base, name: 'Something Else Entirely' });
    const [candidate] = res.json().candidates;

    expect(candidate.band).toBe('note');
    expect(candidate.summary).toBe('Same brand, colour and size');
    expect(candidate.existing_garment.name).toBe(base.name);
  });

  dbIt('returns the garment with its images, ready for the sheet', async () => {
    const base = unique();
    const created = await post(ALICE, base);

    const res = await check(ALICE, base);
    const [candidate] = res.json().candidates;

    // §4 shows both garments as images, "because that is how the user will
    // actually decide" — a candidate the client cannot render is useless.
    expect(candidate.existing_garment.id).toBe(created.json().id);
    expect(candidate.existing_garment).toHaveProperty('canonical_image');
    expect(candidate.score).toBeGreaterThan(0.7);
  });

  dbIt('never looks in another user’s closet (§6, SEC-5)', async () => {
    const base = unique();
    await post(MALLORY, base);

    // Two users owning the same dress is not a duplicate.
    expect((await check(ALICE, base)).json().candidates).toEqual([]);
  });
});

describe('POST /garments — the duplicate gate (CAP-5)', () => {
  dbIt('stops a save that would duplicate, and says which piece', async () => {
    const base = unique();
    const first = await post(ALICE, base);
    expect(first.statusCode).toBe(201);

    const second = await post(ALICE, base);
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('duplicate_unresolved');
    expect(second.json().error.details[0].issue).toContain(first.json().id);
  });

  dbIt('does not stop a save over a quiet match', async () => {
    const base = unique();
    await post(ALICE, base);

    // Below 0.70 Mira does not interrupt mid-capture (§3).
    const res = await post(ALICE, { ...base, name: 'A Different Cut Altogether' });
    expect(res.statusCode).toBe(201);
  });

  dbIt('treats a barcode as decisive, whatever the rest says', async () => {
    const first = await post(ALICE, { ...unique(), barcode: '0 12345-67890 5' });
    expect(first.statusCode).toBe(201);

    // Nothing else in common: another brand, another name, another colour.
    const res = await post(ALICE, {
      ...unique(),
      primary_color: 'white',
      barcode: '012345678905',
    });
    expect(res.statusCode).toBe(409);
  });

  dbIt('creates two garments when the user says she owns two', async () => {
    const base = unique();
    const first = await post(ALICE, base);

    const res = await post(ALICE, {
      ...base,
      duplicate_resolution: { garment_id: first.json().id, relation: 'owns_two' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().id).not.toBe(first.json().id);

    const { rows } = await pool!.query(
      'select relation, detector_score, resolved_by from garment_duplicates where garment_a_id = $1 or garment_b_id = $1',
      [first.json().id],
    );
    expect(rows[0]?.relation).toBe('owns_two');
    expect(rows[0]?.resolved_by).toBe('user');
    expect(Number(rows[0]?.detector_score)).toBeGreaterThan(0.7);
  });

  dbIt('records the negative, which is what makes precision measurable (§7)', async () => {
    const base = unique();
    const first = await post(ALICE, base);

    const res = await post(ALICE, {
      ...base,
      duplicate_resolution: { garment_id: first.json().id, relation: 'different' },
    });
    expect(res.statusCode).toBe(201);

    const { rows } = await pool!.query(
      'select relation from garment_duplicates where garment_a_id = $1 or garment_b_id = $1',
      [first.json().id],
    );
    expect(rows[0]?.relation).toBe('different');
  });

  dbIt('stores one row however the pair arrived', async () => {
    // garment_duplicates has `check (garment_a_id < garment_b_id)`; writing the
    // pair in arrival order would fail for half of all pairs.
    const base = unique();
    const first = await post(ALICE, base);
    const second = await post(ALICE, {
      ...base,
      duplicate_resolution: { garment_id: first.json().id, relation: 'owns_two' },
    });

    const { rows } = await pool!.query<{ garment_a_id: string; garment_b_id: string }>(
      'select garment_a_id, garment_b_id from garment_duplicates where garment_a_id = any($1::uuid[]) or garment_b_id = any($1::uuid[])',
      [[first.json().id, second.json().id]],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.garment_a_id < rows[0]!.garment_b_id).toBe(true);
  });

  dbIt('will not merge into a garment that is not the user’s', async () => {
    const mallorys = await post(MALLORY, unique());
    const base = unique();
    await post(ALICE, base);

    const res = await post(ALICE, {
      ...base,
      duplicate_resolution: { garment_id: mallorys.json().id, relation: 'same_item' },
    });

    // THE 404 RULE: a 403 would confirm the garment exists.
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('garment_not_found');
  });
});

describe('merging (§5)', () => {
  dbIt('adds to the existing garment rather than creating a second', async () => {
    const base = unique();
    const first = await post(ALICE, base);

    const before = (
      await app!.inject({
        method: 'GET',
        url: '/v1/closet',
        headers: await auth(ALICE),
      })
    ).json().total;

    const res = await post(ALICE, {
      ...base,
      purchase_price: 88,
      currency: 'CAD',
      retailer: 'Aritzia',
      duplicate_resolution: { garment_id: first.json().id, relation: 'same_item' },
    });

    // Nothing was created, so 201 would tell the client to add a tile for a
    // piece it is already showing.
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(first.json().id);
    expect(res.json().purchase.price).toEqual({ amount: 88, currency: 'CAD' });

    const after = (
      await app!.inject({
        method: 'GET',
        url: '/v1/closet',
        headers: await auth(ALICE),
      })
    ).json().total;
    expect(after).toBe(before);
  });

  dbIt('never overwrites what is already there', async () => {
    const base = unique();
    const first = await post(ALICE, { ...base, notes: 'Bought in Montreal' });

    const res = await post(ALICE, {
      ...base,
      notes: 'Something else',
      duplicate_resolution: { garment_id: first.json().id, relation: 'same_item' },
    });

    expect(res.json().notes).toBe('Bought in Montreal');
  });

  dbIt('records how the extra information arrived (CAP-3)', async () => {
    const base = unique();
    const first = await post(ALICE, base);

    await post(ALICE, {
      ...base,
      source_type: 'receipt',
      purchase_price: 120,
      currency: 'CAD',
      duplicate_resolution: { garment_id: first.json().id, relation: 'same_item' },
    });

    const { rows } = await pool!.query<{ source_type: string; reference_kind: string | null }>(
      'select source_type, reference_kind from garment_sources where garment_id = $1 order by created_at',
      [first.json().id],
    );

    // A garment must never carry a receipt's price with no record of a receipt.
    expect(rows.map((r) => r.source_type)).toContain('receipt');
    expect(rows.some((r) => r.reference_kind === 'merged_duplicate')).toBe(true);
  });

  dbIt('leaves no duplicate pair behind, because there is only one garment', async () => {
    const base = unique();
    const first = await post(ALICE, base);

    await post(ALICE, {
      ...base,
      duplicate_resolution: { garment_id: first.json().id, relation: 'same_item' },
    });

    const { rows } = await pool!.query(
      'select 1 from garment_duplicates where garment_a_id = $1 or garment_b_id = $1',
      [first.json().id],
    );
    expect(rows).toHaveLength(0);
  });
});

describe('You might already own this (§26, task 9.2)', () => {
  dbIt('raises the quiet band where browsing is the point, not at capture', async () => {
    const base = unique();
    const first = await post(ALICE, base);
    // Scores 0.55 — saved silently at capture (§3), surfaced here.
    const second = await post(ALICE, { ...base, name: 'A Completely Different Cut' });
    expect(second.statusCode).toBe(201);

    const res = await app!.inject({
      method: 'GET',
      url: '/v1/wardrobe/similar-owned',
      headers: await auth(ALICE),
    });
    expect(res.statusCode).toBe(200);

    const ids = [first.json().id, second.json().id].sort();
    const pair = res
      .json()
      .data.find(
        (p: { a: { id: string }; b: { id: string } }) =>
          [p.a.id, p.b.id].sort().join() === ids.join(),
      );

    expect(pair, `pair not surfaced\n${JSON.stringify(res.json().data, null, 2)}`).toBeTruthy();
    // In words, never a score (D-011 is about confidence, and the reasoning
    // here deserves the same treatment).
    expect(pair.summary).toBe('Same brand, colour and size');
    expect(pair).not.toHaveProperty('score');
  });

  dbIt('surfaces a pair whose ONLY signal is the photograph', async () => {
    // Two garments with nothing else in common: different brands, different
    // names, different colours. The pair exists solely because the photographs
    // are near-identical.
    //
    // This is the case that a nomination alone cannot carry. Near-matching
    // hashes NOMINATE the pair, but the score comes from comparing the two
    // subjects — so if the hashes do not reach the scorer, the pair is
    // nominated, scored at zero, and silently dropped.
    const first = await post(ALICE, unique({ primary_color: 'black' }));
    const second = await post(ALICE, unique({ primary_color: 'white' }));

    const hashes = ['ffee00112233aabb', 'ffee00112233aabf'];
    for (const [index, id] of [first.json().id, second.json().id].entries()) {
      await pool!.query(
        `insert into garment_images (garment_id, user_id, kind, storage_key, image_hash, is_canonical)
         select $1, user_id, 'original', $2, $3, true from garments where id = $1`,
        [id, `garments/${id}/original.jpg`, hashes[index]],
      );
    }

    const res = await app!.inject({
      method: 'GET',
      url: '/v1/wardrobe/similar-owned',
      headers: await auth(ALICE),
    });

    const ids = [first.json().id, second.json().id].sort().join();
    const pair = res
      .json()
      .data.find(
        (p: { a: { id: string }; b: { id: string } }) => [p.a.id, p.b.id].sort().join() === ids,
      );

    expect(pair, `photograph-only pair was lost\n${JSON.stringify(res.json().data)}`).toBeTruthy();
    expect(pair.summary).toBe('Nearly the same photograph');
  });

  dbIt('stops asking once the user has said they own two', async () => {
    const base = unique();
    const first = await post(ALICE, base);
    const second = await post(ALICE, {
      ...base,
      duplicate_resolution: { garment_id: first.json().id, relation: 'owns_two' },
    });

    const res = await app!.inject({
      method: 'GET',
      url: '/v1/wardrobe/similar-owned',
      headers: await auth(ALICE),
    });

    const ids = [first.json().id, second.json().id].sort().join();
    const found = res
      .json()
      .data.some(
        (p: { a: { id: string }; b: { id: string } }) => [p.a.id, p.b.id].sort().join() === ids,
      );

    // The interruption budget of §1 is not spent on a question already
    // answered.
    expect(found).toBe(false);
  });

  dbIt('never crosses into another closet', async () => {
    const base = unique();
    await post(ALICE, base);
    await post(MALLORY, base);

    const res = await app!.inject({
      method: 'GET',
      url: '/v1/wardrobe/similar-owned',
      headers: await auth(MALLORY),
    });
    expect(res.json().data).toEqual([]);
  });
});
