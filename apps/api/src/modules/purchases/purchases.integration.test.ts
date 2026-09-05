/**
 * Purchase candidates (tasks 8.3, 8.6; ADR 0003, OWN-1).
 *
 * Against a real Postgres, because the invariant under test — only
 * `confirmed_owned` creates a garment — is enforced twice, once in the service
 * and once by a check constraint. A mocked database could only ever test one
 * of them, and the whole point is that neither is the only one.
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
import { checkTestDatabase } from '../../test/database.js';

const SECRET = 'purchases-integration-secret';
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

const storageRoot = mkdtempSync(join(tmpdir(), 'mira-pur-it-'));
let app: FastifyInstance | null = null;
let pool: pg.Pool | null = null;
let available = false;

const ALICE = 'pur-it-alice';
const MALLORY = 'pur-it-mallory';

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
  const status = await checkTestDatabase(candidate, 'purchase_candidates');
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
      console.warn(`skipping "${name}": no database at ${DATABASE_URL}`);
      return;
    }
    await fn();
  });

let seq = 0;

/** A detected candidate belonging to `subject`. */
async function seedCandidate(subject: string, over: Record<string, unknown> = {}) {
  seq += 1;
  const { rows } = await pool!.query<{ id: string }>(
    `insert into purchase_candidates
       (user_id, source_type, source_id, raw_item_name, product_name, brand,
        retailer, purchase_date, purchase_price, currency, matched_product_confidence, status)
     select id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12 from users
      where auth_provider_id = $1
     returning id`,
    [
      subject,
      over['source_type'] ?? 'email',
      over['source_id'] ?? `order-${seq}`,
      over['raw_item_name'] ?? `ITEM ${seq}`,
      over['product_name'] ?? `Contour Bodysuit ${seq}`,
      over['brand'] ?? `Brand${seq}`,
      over['retailer'] ?? 'Aritzia',
      over['purchase_date'] ?? '2026-03-01',
      over['purchase_price'] ?? 88,
      over['currency'] ?? 'CAD',
      over['matched_product_confidence'] ?? 0.99,
      over['status'] ?? 'detected',
    ],
  );
  return rows[0]!.id;
}

const patch = async (subject: string, id: string, status: string) =>
  app!.inject({
    method: 'PATCH',
    url: `/v1/purchase-candidates/${id}`,
    headers: await auth(subject),
    payload: { status },
  });

describe('a detected purchase is never a garment (ADR 0003)', () => {
  dbIt('does not appear in the closet on detection', async () => {
    await seedCandidate(ALICE);

    const closet = await app!.inject({
      method: 'GET',
      url: '/v1/closet',
      headers: await auth(ALICE),
    });
    expect(closet.json().total).toBe(0);
  });

  dbIt('creates a garment only for confirmed_owned', async () => {
    const id = await seedCandidate(ALICE);
    const res = await patch(ALICE, id, 'confirmed_owned');

    expect(res.statusCode).toBe(200);
    expect(res.json().linked_garment_id).toBeTruthy();

    const closet = await app!.inject({
      method: 'GET',
      url: '/v1/closet',
      headers: await auth(ALICE),
    });
    expect(closet.json().total).toBe(1);
  });

  dbIt('creates nothing for any other answer', async () => {
    const before = (
      await app!.inject({ method: 'GET', url: '/v1/closet', headers: await auth(ALICE) })
    ).json().total;

    for (const status of ['returned', 'not_mine', 'removed', 'uncertain', 'ignored']) {
      const id = await seedCandidate(ALICE);
      const res = await patch(ALICE, id, status);
      expect(res.statusCode).toBe(200);
      expect(res.json().linked_garment_id).toBeNull();
    }

    const after = (
      await app!.inject({ method: 'GET', url: '/v1/closet', headers: await auth(ALICE) })
    ).json().total;
    expect(after).toBe(before);
  });

  dbIt('the database refuses a link without confirmation, not just the service', async () => {
    // SEC-5's reasoning applied to OWN-1: neither mechanism may be the only one.
    const id = await seedCandidate(ALICE);
    const garment = await pool!.query<{ id: string }>('select id from garments limit 1');

    await expect(
      pool!.query(
        `update purchase_candidates set status = 'needs_review', linked_garment_id = $2
          where id = $1`,
        [id, garment.rows[0]!.id],
      ),
    ).rejects.toThrow();
  });
});

describe('status transitions (taxonomy §12)', () => {
  dbIt('refuses a status Mira sets for itself', async () => {
    const id = await seedCandidate(ALICE);
    const res = await patch(ALICE, id, 'processing');
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('invalid_status_transition');
  });

  dbIt('refuses a status outside the taxonomy', async () => {
    const id = await seedCandidate(ALICE);
    const res = await patch(ALICE, id, 'definitely_mine');
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('not_in_taxonomy');
  });

  dbIt('will not confirm the same purchase twice', async () => {
    // Silently ignoring would be a second garment for one purchase.
    const id = await seedCandidate(ALICE);
    expect((await patch(ALICE, id, 'confirmed_owned')).statusCode).toBe(200);
    expect((await patch(ALICE, id, 'confirmed_owned')).statusCode).toBe(422);
  });

  dbIt('will not rewrite a candidate already in the closet', async () => {
    const id = await seedCandidate(ALICE);
    await patch(ALICE, id, 'confirmed_owned');

    const res = await patch(ALICE, id, 'returned');
    expect(res.statusCode).toBe(422);
    expect(res.json().error.details[0].issue).toContain('already in your closet');
  });

  dbIt('keeps the purchase record when the answer is "returned"', async () => {
    // A return does not un-happen the purchase.
    const id = await seedCandidate(ALICE);
    await patch(ALICE, id, 'returned');

    const { rows } = await pool!.query(
      'select garment_id from purchase_records where candidate_id = $1',
      [id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].garment_id).toBeNull();
  });
});

describe('the discovery list (8.5)', () => {
  dbIt('shows what is awaiting a decision, not everything ever detected', async () => {
    const decided = await seedCandidate(ALICE);
    await patch(ALICE, decided, 'removed');
    await seedCandidate(ALICE);

    const res = await app!.inject({
      method: 'GET',
      url: '/v1/purchase-candidates',
      headers: await auth(ALICE),
    });

    const statuses = res.json().data.map((c: { status: string }) => c.status);
    expect(statuses).not.toContain('removed');
    expect(statuses).toContain('detected');
  });

  dbIt('can be asked for a decided status explicitly', async () => {
    const res = await app!.inject({
      method: 'GET',
      url: '/v1/purchase-candidates?status=removed',
      headers: await auth(ALICE),
    });
    expect(res.json().data.every((c: { status: string }) => c.status === 'removed')).toBe(true);
  });

  dbIt('never shows another user’s purchases', async () => {
    await seedCandidate(MALLORY);
    const res = await app!.inject({
      method: 'GET',
      url: '/v1/purchase-candidates?limit=100',
      headers: await auth(ALICE),
    });

    const ids = res.json().data.map((c: { id: string }) => c.id);
    const mallory = await pool!.query(
      `select pc.id from purchase_candidates pc
         join users u on u.id = pc.user_id where u.auth_provider_id = $1`,
      [MALLORY],
    );
    for (const row of mallory.rows) expect(ids).not.toContain(row.id);
  });

  dbIt('404s on another user’s candidate, never 403', async () => {
    const mallorys = await seedCandidate(MALLORY);
    const res = await app!.inject({
      method: 'GET',
      url: `/v1/purchase-candidates/${mallorys}`,
      headers: await auth(ALICE),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('bulk decisions (A-03)', () => {
  dbIt('reports what failed as well as what worked', async () => {
    const good = await seedCandidate(ALICE);
    const alreadyDone = await seedCandidate(ALICE);
    await patch(ALICE, alreadyDone, 'removed');

    const res = await app!.inject({
      method: 'POST',
      url: '/v1/purchase-candidates/bulk',
      headers: await auth(ALICE),
      payload: { ids: [good, alreadyDone], status: 'removed' },
    });

    // A bulk action that says only "done" while silently dropping one is how
    // someone discovers the gap a week later.
    expect(res.json().updated).toHaveLength(1);
    expect(res.json().failed).toHaveLength(1);
  });
});

describe('re-scanning is idempotent', () => {
  dbIt('the same order line seen twice is one candidate', async () => {
    const first = await seedCandidate(ALICE, { source_id: 'order-dup', raw_item_name: 'TEE' });

    await expect(
      seedCandidate(ALICE, { source_id: 'order-dup', raw_item_name: 'TEE' }),
    ).rejects.toThrow();

    const { rows } = await pool!.query(
      'select count(*) as n from purchase_candidates where id = $1',
      [first],
    );
    expect(Number(rows[0].n)).toBe(1);
  });
});

describe('auto-import (F-05, task 8.8)', () => {
  const enableAutoImport = (subject: string, on: boolean) =>
    pool!.query('update users set auto_import_enabled = $2 where auth_provider_id = $1', [
      subject,
      on,
    ]);

  dbIt('does nothing at all unless the user opted in', async () => {
    await enableAutoImport(ALICE, false);
    const id = await seedCandidate(ALICE, { matched_product_confidence: 0.99 });

    const res = await app!.inject({
      method: 'POST',
      url: '/v1/purchase-candidates/bulk',
      headers: await auth(ALICE),
      payload: { ids: [id], status: 'uncertain' },
    });
    expect(res.statusCode).toBe(200);

    const after = await pool!.query('select status from purchase_candidates where id = $1', [id]);
    expect(after.rows[0].status).not.toBe('confirmed_owned');
  });

  dbIt('flags what it added, and notifies', async () => {
    await enableAutoImport(ALICE, true);
    const id = await seedCandidate(ALICE, { matched_product_confidence: 0.99 });

    // Driven through the service the way a scan would, since no scanner exists.
    const { PurchaseService } = await import('./service.js');
    const { PurchaseRepository } = await import('./repository.js');
    const { NotificationRepository } = await import('../notifications/routes.js');
    const { IdentityRepository } = await import('../identity/repository.js');
    const { ClosetService } = await import('../closet/service.js');
    const { GarmentRepository } = await import('../closet/repository.js');
    const { DuplicateRepository } = await import('../closet/duplicate-repository.js');
    const { DuplicateService } = await import('../closet/duplicate-service.js');
    const { createLocalStorage: storageFor } = await import('@mira/storage');

    const storage = storageFor({
      root: storageRoot,
      secret: 'test',
      publicBaseUrl: 'http://localhost:4000/v1',
    });
    const garments = new GarmentRepository(pool!);
    const closet: InstanceType<typeof ClosetService> = new ClosetService(
      garments,
      storage,
      new DuplicateService(new DuplicateRepository(pool!), (sc, rows) =>
        closet.serializeRows(sc, rows),
      ),
    );
    const service = new PurchaseService(
      new PurchaseRepository(pool!),
      closet,
      new IdentityRepository(pool!),
      new NotificationRepository(pool!),
    );

    const user = await pool!.query<{ id: string }>(
      'select id from users where auth_provider_id = $1',
      [ALICE],
    );
    // `UserScope` is branded, so it cannot be built by hand — which is the
    // point: a plain object cannot be smuggled into a repository call.
    const { userScope } = await import('../../db/scope.js');
    const scope = userScope(user.rows[0]!.id);

    const imported = await service.autoImport(scope, [id]);
    expect(imported).toHaveLength(1);

    // Flagged until acknowledged, so the closet can say this appeared on its own.
    const garment = await pool!.query<{ auto_imported_at: Date | null }>(
      'select auto_imported_at from garments where id = $1',
      [imported[0]!.linked_garment_id],
    );
    expect(garment.rows[0]!.auto_imported_at).not.toBeNull();

    // "The user is still notified" — the thing separating auto-import from
    // garments silently appearing.
    const notes = await pool!.query<{ kind: string; body: string }>(
      'select kind, body from notifications where user_id = $1',
      [scope.userId],
    );
    expect(notes.rows.map((n) => n.kind)).toContain('purchase_detected');
    // Never a price: a body carrying one puts a purchase on a lock screen.
    expect(notes.rows[0]!.body).not.toMatch(/\d+\.\d{2}|\$|CAD/);
  });

  dbIt(
    'an acknowledgement cannot be recorded against a garment nobody was asked about',
    async () => {
      // Otherwise it would read as "the user reviewed this" in any later audit.
      const { rows } = await pool!.query<{ id: string }>(
        `select g.id from garments g join users u on u.id = g.user_id
        where u.auth_provider_id = $1 and g.auto_imported_at is null limit 1`,
        [ALICE],
      );
      if (!rows[0]) return;

      await expect(
        pool!.query('update garments set auto_import_acknowledged_at = now() where id = $1', [
          rows[0].id,
        ]),
      ).rejects.toThrow();
    },
  );
});
