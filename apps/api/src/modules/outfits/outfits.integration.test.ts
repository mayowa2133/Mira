/**
 * Outfits and wear tracking against a REAL Postgres.
 *
 * The two behaviours worth this much setup are the ones that cannot be checked
 * without the database: that wearing a look wears every garment in it, and that
 * `worn_count` is derived by a trigger rather than written by anyone.
 *
 *   npm run db:up && npm run db:migrate && npm test
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SignJWT } from 'jose';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../http/server.js';
import { loadEnv } from '../../config/env.js';
import { createDevVerifier } from '../identity/verify.js';
import { createLogger } from '../../lib/logger.js';
import { createLocalStorage } from '@mira/storage';

const SECRET = 'outfits-integration-secret';
const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://mira:mira@localhost:5433/mira';

const testEnv = loadEnv({
  NODE_ENV: 'test',
  MIRA_ENV: 'local',
  LOG_LEVEL: 'fatal',
  DEV_AUTH_SECRET: SECRET,
  JWT_AUDIENCE: 'mira',
  DATABASE_URL,
} as NodeJS.ProcessEnv);

const storageRoot = mkdtempSync(join(tmpdir(), 'mira-outfits-it-'));

let app: FastifyInstance | null = null;
let pool: pg.Pool | null = null;
let available = false;

const ALICE = 'outfits-it-alice';
const MALLORY = 'outfits-it-mallory';

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

async function userIdOf(subject: string): Promise<string> {
  const { rows } = await pool!.query<{ id: string }>(
    'select id from users where auth_provider_id = $1',
    [subject],
  );
  return rows[0]!.id;
}

/** A garment in Alice's closet, of a given category. */
async function garment(category = 'tops'): Promise<string> {
  const userId = await userIdOf(ALICE);
  const { rows } = await pool!.query<{ id: string }>(
    `insert into garments (user_id, closet_id, category, source_type, analysis_state)
     values ($1, (select id from closets where user_id = $1 limit 1), $2, 'manual', 'skipped')
     returning id`,
    [userId, category],
  );
  return rows[0]!.id;
}

async function createLook(items: { garment_id: string; slot: string }[]) {
  const response = await app!.inject({
    method: 'POST',
    url: '/v1/outfits',
    headers: await auth(ALICE),
    payload: { name: 'Dinner', occasion: 'dinner', items },
  });
  return response;
}

beforeAll(async () => {
  process.env['DATABASE_URL'] = DATABASE_URL;
  const candidate = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
  try {
    const { rows } = await candidate.query<{ count: string }>(
      "select count(*) as count from information_schema.tables where table_name = 'outfits'",
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

beforeEach(async () => {
  if (!available || !pool) return;
  const userId = await userIdOf(ALICE);
  await pool.query('delete from wear_events where user_id = $1', [userId]);
  await pool.query('delete from outfits where user_id = $1', [userId]);
  await pool.query('delete from garments where user_id = $1', [userId]);
});

const dbIt = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!available || !app) {
      console.warn(`skipping "${name}": no migrated database at ${DATABASE_URL}`);
      return;
    }
    await fn();
  });

describe('POST /outfits', () => {
  dbIt('creates a look from owned garments', async () => {
    const top = await garment('tops');
    const bottom = await garment('bottoms');

    const response = await createLook([
      { garment_id: top, slot: 'top' },
      { garment_id: bottom, slot: 'bottom' },
    ]);

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.items).toHaveLength(2);
    expect(body.wear).toMatchObject({ count: 0, last_worn_at: null });
  });

  dbIt('saves a dress worn over a top, because that is a real outfit', async () => {
    // taxonomy §14: the user may override the exclusivity rule. A product that
    // refuses to save this is wrong about clothes.
    const dress = await garment('dresses');
    const top = await garment('tops');

    const response = await createLook([
      { garment_id: dress, slot: 'dress' },
      { garment_id: top, slot: 'top' },
    ]);

    expect(response.statusCode).toBe(201);
    expect(response.json().items).toHaveLength(2);
  });

  dbIt("refuses another user's garment", async () => {
    const mallorysUserId = await userIdOf(MALLORY);
    const { rows } = await pool!.query<{ id: string }>(
      `insert into garments (user_id, closet_id, category, source_type, analysis_state)
       values ($1, (select id from closets where user_id = $1 limit 1), 'tops', 'manual', 'skipped')
       returning id`,
      [mallorysUserId],
    );

    const response = await createLook([{ garment_id: rows[0]!.id, slot: 'top' }]);
    expect(response.statusCode).toBe(404);
  });

  dbIt('rejects an unknown slot rather than storing it', async () => {
    const top = await garment('tops');
    const response = await createLook([{ garment_id: top, slot: 'hat' }]);

    // 422, per the error contract: failed validation, shown inline.
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('validation_failed');
  });

  dbIt('refuses a look with no pieces', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: '/v1/outfits',
      headers: await auth(ALICE),
      payload: { name: 'Empty', items: [] },
    });
    expect(response.statusCode).toBe(422);
  });

  dbIt('requires an Idempotency-Key', async () => {
    const top = await garment('tops');
    const response = await app!.inject({
      method: 'POST',
      url: '/v1/outfits',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
      payload: { items: [{ garment_id: top, slot: 'top' }] },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('POST /wear-events', () => {
  dbIt('wearing a look wears every garment in it', async () => {
    const top = await garment('tops');
    const bottom = await garment('bottoms');
    const look = (
      await createLook([
        { garment_id: top, slot: 'top' },
        { garment_id: bottom, slot: 'bottom' },
      ])
    ).json();

    const response = await app!.inject({
      method: 'POST',
      url: '/v1/wear-events',
      headers: await auth(ALICE),
      payload: { outfit_id: look.id },
    });

    expect(response.statusCode).toBe(201);
    // One for the look, one for each garment.
    expect(response.json().created).toBe(3);

    const { rows } = await pool!.query<{ worn_count: number }>(
      'select worn_count from garments where id = any($1::uuid[])',
      [[top, bottom]],
    );
    // Without this, "I wore this look" would leave every garment in it still
    // reading as never worn.
    expect(rows.map((r) => r.worn_count)).toEqual([1, 1]);
  });

  dbIt('derives the counters rather than trusting anyone to set them', async () => {
    const top = await garment('tops');

    for (const day of ['2026-09-01', '2026-09-02', '2026-09-03']) {
      await app!.inject({
        method: 'POST',
        url: '/v1/wear-events',
        headers: await auth(ALICE),
        payload: { garment_id: top, worn_on: day },
      });
    }

    const { rows } = await pool!.query<{ worn_count: number; last_worn_at: Date }>(
      'select worn_count, last_worn_at from garments where id = $1',
      [top],
    );
    expect(rows[0]!.worn_count).toBe(3);
    expect(rows[0]!.last_worn_at?.toISOString().slice(0, 10)).toBe('2026-09-03');
  });

  dbIt('a deleted wear takes the count back down', async () => {
    const top = await garment('tops');
    const created = await app!.inject({
      method: 'POST',
      url: '/v1/wear-events',
      headers: await auth(ALICE),
      payload: { garment_id: top },
    });

    await app!.inject({
      method: 'DELETE',
      url: `/v1/wear-events/${created.json().ids[0]}`,
      headers: await auth(ALICE),
    });

    const { rows } = await pool!.query<{ worn_count: number; last_worn_at: Date | null }>(
      'select worn_count, last_worn_at from garments where id = $1',
      [top],
    );
    // Recomputed, not decremented: a double-fire cannot drift the number.
    expect(rows[0]!.worn_count).toBe(0);
    expect(rows[0]!.last_worn_at).toBeNull();
  });

  dbIt('defaults to today', async () => {
    const top = await garment('tops');
    await app!.inject({
      method: 'POST',
      url: '/v1/wear-events',
      headers: await auth(ALICE),
      payload: { garment_id: top },
    });

    const { rows } = await pool!.query<{ worn_on: string }>(
      'select worn_on::text as worn_on from wear_events where garment_id = $1',
      [top],
    );
    expect(rows[0]!.worn_on).toBe(new Date().toISOString().slice(0, 10));
  });

  dbIt('refuses an event about nothing', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: '/v1/wear-events',
      headers: await auth(ALICE),
      payload: { note: 'lovely day' },
    });
    expect(response.statusCode).toBe(422);
  });

  dbIt("refuses another user's garment", async () => {
    const mallorysUserId = await userIdOf(MALLORY);
    const { rows } = await pool!.query<{ id: string }>(
      `insert into garments (user_id, closet_id, category, source_type, analysis_state)
       values ($1, (select id from closets where user_id = $1 limit 1), 'tops', 'manual', 'skipped')
       returning id`,
      [mallorysUserId],
    );

    const response = await app!.inject({
      method: 'POST',
      url: '/v1/wear-events',
      headers: await auth(ALICE),
      payload: { garment_id: rows[0]!.id },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('GET /outfits', () => {
  dbIt('separates the tabs by what they actually ask', async () => {
    const top = await garment('tops');
    const look = (await createLook([{ garment_id: top, slot: 'top' }])).json();

    const mine = await app!.inject({
      method: 'GET',
      url: '/v1/outfits?tab=mine',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });
    expect(mine.json().data).toHaveLength(1);

    // Not worn and not saved yet.
    for (const tab of ['worn', 'saved']) {
      const response = await app!.inject({
        method: 'GET',
        url: `/v1/outfits?tab=${tab}`,
        headers: { authorization: `Bearer ${await token(ALICE)}` },
      });
      expect(response.json().data).toHaveLength(0);
    }

    await app!.inject({
      method: 'POST',
      url: `/v1/outfits/${look.id}/favorite`,
      headers: await auth(ALICE),
      payload: { favorite: true },
    });
    await app!.inject({
      method: 'POST',
      url: '/v1/wear-events',
      headers: await auth(ALICE),
      payload: { outfit_id: look.id },
    });

    for (const tab of ['worn', 'saved']) {
      const response = await app!.inject({
        method: 'GET',
        url: `/v1/outfits?tab=${tab}`,
        headers: { authorization: `Bearer ${await token(ALICE)}` },
      });
      expect(response.json().data, tab).toHaveLength(1);
    }
  });

  dbIt("never shows another user's looks", async () => {
    const top = await garment('tops');
    await createLook([{ garment_id: top, slot: 'top' }]);

    const response = await app!.inject({
      method: 'GET',
      url: '/v1/outfits?tab=mine',
      headers: { authorization: `Bearer ${await token(MALLORY)}` },
    });
    expect(response.json().data).toHaveLength(0);
  });
});

describe('the Looks library needs imagery', () => {
  dbIt('hydrates images in the LIST, not only on detail', async () => {
    // The library is a masonry of collages; a list without imagery is a screen
    // of blank cards, which is exactly what shipped before this test.
    const top = await garment('tops');
    const userId = await userIdOf(ALICE);
    await pool!.query(
      `insert into garment_images (garment_id, user_id, kind, storage_key, is_canonical, position)
       values ($1, $2, 'original', $3, true, 0)`,
      [top, userId, `garments/${userId}/${top}.jpg`],
    );

    await createLook([{ garment_id: top, slot: 'top' }]);

    const response = await app!.inject({
      method: 'GET',
      url: '/v1/outfits?tab=mine',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });

    expect(response.json().data[0].items[0].image_url).toBeTruthy();
  });

  dbIt('counts a look as worn once, however many pieces it has', async () => {
    // Wearing a look records an event per garment too, for provenance. Counting
    // those as wears of the LOOK inflated it with every extra piece.
    const top = await garment('tops');
    const bottom = await garment('bottoms');
    const look = (
      await createLook([
        { garment_id: top, slot: 'top' },
        { garment_id: bottom, slot: 'bottom' },
      ])
    ).json();

    await app!.inject({
      method: 'POST',
      url: '/v1/wear-events',
      headers: await auth(ALICE),
      payload: { outfit_id: look.id },
    });

    const { rows } = await pool!.query<{ worn_count: number }>(
      'select worn_count from outfits where id = $1',
      [look.id],
    );
    expect(rows[0]!.worn_count).toBe(1);

    // The garments still count their own wear.
    const garments = await pool!.query<{ worn_count: number }>(
      'select worn_count from garments where id = any($1::uuid[])',
      [[top, bottom]],
    );
    expect(garments.rows.map((r) => r.worn_count)).toEqual([1, 1]);
  });
});

describe('GET /outfits/:id', () => {
  dbIt('hydrates each garment so look detail needs one request', async () => {
    const top = await garment('tops');
    const look = (await createLook([{ garment_id: top, slot: 'top' }])).json();

    const response = await app!.inject({
      method: 'GET',
      url: `/v1/outfits/${look.id}`,
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });

    const item = response.json().items[0];
    expect(item).toMatchObject({ garment_id: top, slot: 'top', category: 'tops' });
  });

  dbIt("404s on another user's look", async () => {
    const top = await garment('tops');
    const look = (await createLook([{ garment_id: top, slot: 'top' }])).json();

    const response = await app!.inject({
      method: 'GET',
      url: `/v1/outfits/${look.id}`,
      headers: { authorization: `Bearer ${await token(MALLORY)}` },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('wardrobe insights (Phase 9)', () => {
  /** A closet big enough for insights to be allowed to speak. */
  async function stockedCloset(count: number): Promise<string[]> {
    const userId = await userIdOf(ALICE);
    const ids: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const { rows } = await pool!.query<{ id: string }>(
        `insert into garments (user_id, closet_id, category, source_type, analysis_state,
                               purchase_price, currency, created_at)
         values ($1, (select id from closets where user_id = $1 limit 1), 'tops', 'manual',
                 'skipped', 40, 'GBP', now() - interval '200 days')
         returning id`,
        [userId],
      );
      ids.push(rows[0]!.id);
    }
    return ids;
  }

  dbIt('says nothing at all about a new closet', async () => {
    await stockedCloset(3);

    const response = await app!.inject({
      method: 'GET',
      url: '/v1/wardrobe/insights',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });

    // Telling someone who joined last week that they never wear their clothes
    // is useless and faintly rude.
    expect(response.json().data).toEqual([]);
  });

  dbIt('reports never-worn pieces once the closet is big enough', async () => {
    await stockedCloset(15);

    const response = await app!.inject({
      method: 'GET',
      url: '/v1/wardrobe/insights?kinds=never_worn',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });

    const insight = response.json().data[0];
    expect(insight.kind).toBe('never_worn');
    expect(insight.headline).toBe("You've never worn these 👀");
    expect(insight.garments.length).toBeGreaterThan(1);
  });

  dbIt('separates forgotten from never worn', async () => {
    const ids = await stockedCloset(15);
    const userId = await userIdOf(ALICE);

    // Two pieces worn, but long ago.
    for (const id of ids.slice(0, 2)) {
      await pool!.query(
        `insert into wear_events (user_id, garment_id, worn_on)
         values ($1, $2, current_date - 200)`,
        [userId, id],
      );
    }

    const response = await app!.inject({
      method: 'GET',
      url: '/v1/wardrobe/insights?kinds=forgotten,never_worn',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });

    const insights = response.json().data as {
      kind: string;
      total: number;
      headline: string;
      garments: unknown[];
    }[];
    const byKind = Object.fromEntries(insights.map((i) => [i.kind, i.garments]));

    // The headline counts everything that qualifies; the rail is a preview.
    // Reporting the rail length understates it, and more so the more there is
    // to say.
    const neverWorn = insights.find((i) => i.kind === 'never_worn');
    expect(neverWorn?.total).toBe(13);
    expect(neverWorn?.garments).toHaveLength(12);

    // "I forgot about this" and "I never wore this" are different feelings.
    expect(byKind['forgotten']).toHaveLength(2);
    // Capped at a rail's worth: an insight is content, not a list of
    // everything that qualifies.
    expect(byKind['never_worn']).toHaveLength(12);
  });

  dbIt('needs real wear before naming a most-loved piece', async () => {
    const ids = await stockedCloset(15);
    const userId = await userIdOf(ALICE);

    await pool!.query(
      `insert into wear_events (user_id, garment_id, worn_on) values ($1, $2, current_date)`,
      [userId, ids[0]],
    );

    const once = await app!.inject({
      method: 'GET',
      url: '/v1/wardrobe/insights?kinds=most_loved',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });
    // One wear does not make a favourite; it makes a Tuesday.
    expect(once.json().data).toEqual([]);

    for (const day of [1, 2, 3]) {
      await pool!.query(
        `insert into wear_events (user_id, garment_id, worn_on)
         values ($1, $2, current_date - ($3 || ' days')::interval)`,
        [userId, ids[0], String(day)],
      );
    }

    const now = await app!.inject({
      method: 'GET',
      url: '/v1/wardrobe/insights?kinds=most_loved',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });
    expect(now.json().data[0].garments).toHaveLength(1);
    expect(now.json().data[0].garments[0].worn_count).toBe(4);
  });

  dbIt('reports cost per wear only for pieces actually worn', async () => {
    const ids = await stockedCloset(15);
    const userId = await userIdOf(ALICE);

    for (const day of [1, 2, 3, 4]) {
      await pool!.query(
        `insert into wear_events (user_id, garment_id, worn_on)
         values ($1, $2, current_date - ($3 || ' days')::interval)`,
        [userId, ids[0], String(day)],
      );
    }

    const stats = await app!.inject({
      method: 'GET',
      url: '/v1/wardrobe/stats',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });

    const body = stats.json();
    expect(body.closet_value.total).toBe(600);
    expect(body.closet_value.priced_pieces).toBe(15);
    // £40 over 4 wears, and only that piece counts — including unworn pieces
    // would make the wardrobe look more expensive the more of it was
    // catalogued.
    expect(body.cost_per_wear.average).toBe(10);
    expect(body.cost_per_wear.based_on_pieces).toBe(1);
  });

  dbIt('groups wear history by day for the calendar', async () => {
    const ids = await stockedCloset(15);
    const userId = await userIdOf(ALICE);

    await pool!.query(
      `insert into wear_events (user_id, garment_id, worn_on) values ($1, $2, current_date)`,
      [userId, ids[0]],
    );
    await pool!.query(
      `insert into wear_events (user_id, garment_id, worn_on) values ($1, $2, current_date)`,
      [userId, ids[1]],
    );

    const response = await app!.inject({
      method: 'GET',
      url: '/v1/wardrobe/wear-history',
      headers: { authorization: `Bearer ${await token(ALICE)}` },
    });

    const days = response.json().data;
    expect(days).toHaveLength(1);
    expect(days[0].garment_ids).toHaveLength(2);
  });

  dbIt("never reports another user's closet", async () => {
    await stockedCloset(15);

    const response = await app!.inject({
      method: 'GET',
      url: '/v1/wardrobe/stats',
      headers: { authorization: `Bearer ${await token(MALLORY)}` },
    });
    expect(response.json().closet_value.priced_pieces).toBe(0);
  });
});
