/**
 * Auth endpoints (`docs/05-api/auth-contract.md`, task 0.5).
 *
 * Against a real Postgres, because what is being tested is the Mira side of the
 * session: which user a verified subject resolves to, what a deletion request
 * records, and what happens when the managed provider is not there.
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
import { createDevVerifier } from './verify.js';
import { ProviderUnavailable, type IdentityProvider } from './provider.js';
import { createLogger } from '../../lib/logger.js';
import { createLocalStorage } from '@mira/storage';
import { checkTestDatabase } from '../../test/database.js';

const SECRET = 'auth-integration-secret';
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

const storageRoot = mkdtempSync(join(tmpdir(), 'mira-auth-it-'));

let app: FastifyInstance | null = null;
let pool: pg.Pool | null = null;
let available = false;

const ALICE = 'auth-it-alice';
const BOB = 'auth-it-bob';

/** Records what was asked of the provider, and can be told to be absent. */
const provider = {
  revoked: [] as string[],
  deleted: [] as string[],
  present: true,
};

const testProvider: IdentityProvider = {
  name: 'test',
  refresh: (token) => {
    if (!provider.present) return Promise.reject(new ProviderUnavailable('refresh'));
    return Promise.resolve({
      accessToken: `access-for-${token}`,
      refreshToken: 'rotated',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
  },
  revokeSessions: (subject) => {
    if (!provider.present) return Promise.reject(new ProviderUnavailable('sign-out'));
    provider.revoked.push(subject);
    return Promise.resolve();
  },
  deleteIdentity: (subject) => {
    if (!provider.present) return Promise.reject(new ProviderUnavailable('identity deletion'));
    provider.deleted.push(subject);
    return Promise.resolve();
  },
};

async function token(subject: string): Promise<string> {
  return new SignJWT({ email: `${subject}@mira.local` })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setAudience('mira')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));
}

const auth = async (subject: string) => ({ authorization: `Bearer ${await token(subject)}` });

beforeAll(async () => {
  process.env['DATABASE_URL'] = DATABASE_URL;
  const candidate = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
  // Throws on a stale schema rather than skipping — see the note in
  // `test/database.ts`, which this file is the reason for.
  const status = await checkTestDatabase(candidate, 'account_deletions');
  if (!status.available) {
    await candidate.end().catch(() => undefined);
    available = false;
    return;
  }
  pool = candidate;
  available = true;

  await pool.query('delete from users where auth_provider_id = any($1::text[])', [[ALICE, BOB]]);
  await pool.query('delete from account_deletions');

  app = await buildServer({
    env: testEnv,
    verifier: createDevVerifier(testEnv),
    logger: createLogger({ level: 'fatal', sink: () => undefined }),
    checkDependencies: async () => ({ database: true, queue: true, storage: true }),
    identityProvider: testProvider,
    storage: createLocalStorage({
      root: storageRoot,
      secret: 'test',
      publicBaseUrl: 'http://localhost:4000/v1',
    }),
  });
});

afterAll(async () => {
  await app?.close();
  await pool
    ?.query('delete from users where auth_provider_id = any($1::text[])', [[ALICE, BOB]])
    .catch(() => undefined);
  await pool?.query('delete from account_deletions').catch(() => undefined);
  await pool?.end();
  rmSync(storageRoot, { recursive: true, force: true });
});

const dbIt = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!available || !app) {
      console.warn(`skipping "${name}": no migrated database at ${DATABASE_URL}`);
      return;
    }
    provider.revoked = [];
    provider.deleted = [];
    provider.present = true;
    await fn();
  });

describe('POST /auth/session', () => {
  dbIt('creates the user and their closet on first sign-in', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/auth/session',
      headers: await auth(ALICE),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe(`${ALICE}@mira.local`);
    expect(res.json().user.closet_id).toBeTruthy();
    // A brand-new account has not been through onboarding.
    expect(res.json().user.onboarding_state).toBe('not_started');
  });

  dbIt('is idempotent — signing in twice is signing in', async () => {
    const first = await app!.inject({
      method: 'POST',
      url: '/v1/auth/session',
      headers: await auth(ALICE),
    });
    const second = await app!.inject({
      method: 'POST',
      url: '/v1/auth/session',
      headers: await auth(ALICE),
    });

    expect(second.statusCode).toBe(200);
    expect(second.json().user.id).toBe(first.json().user.id);
    expect(second.json().user.closet_id).toBe(first.json().user.closet_id);
  });

  dbIt('refuses an unverified caller', async () => {
    const res = await app!.inject({ method: 'POST', url: '/v1/auth/session' });
    expect(res.statusCode).toBe(401);
  });

  dbIt('never returns a token', async () => {
    // The provider issues tokens; this endpoint resolves a user. A token in
    // this response would mean Mira had started minting sessions of its own.
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/auth/session',
      headers: await auth(ALICE),
    });
    expect(JSON.stringify(res.json())).not.toMatch(/token/i);
  });
});

describe('POST /auth/refresh', () => {
  dbIt('rotates through the provider', async () => {
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refresh_token: 'r1' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().refresh_token).toBe('rotated');
    expect(res.json().expires_at).toBeTruthy();
  });

  dbIt('validates the body', async () => {
    const res = await app!.inject({ method: 'POST', url: '/v1/auth/refresh', payload: {} });
    expect(res.statusCode).toBe(422);
  });

  dbIt('says so when there is no provider, rather than failing quietly', async () => {
    provider.present = false;
    const res = await app!.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refresh_token: 'r1' },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('service_unavailable');
  });
});

describe('DELETE /auth/session', () => {
  dbIt('revokes the family at the provider', async () => {
    const res = await app!.inject({
      method: 'DELETE',
      url: '/v1/auth/session',
      headers: await auth(ALICE),
    });
    expect(res.statusCode).toBe(204);
    expect(provider.revoked).toEqual([ALICE]);
  });

  dbIt('fails loudly when it cannot revoke', async () => {
    // A sign-out that silently revokes nothing leaves a live session on a
    // device the user believes they signed out of.
    provider.present = false;
    const res = await app!.inject({
      method: 'DELETE',
      url: '/v1/auth/session',
      headers: await auth(ALICE),
    });
    expect(res.statusCode).toBe(503);
  });
});

describe('DELETE /auth/account', () => {
  dbIt('records the request and revokes immediately', async () => {
    const res = await app!.inject({
      method: 'DELETE',
      url: '/v1/auth/account',
      headers: await auth(BOB),
    });

    expect(res.statusCode).toBe(202);
    expect(res.json().status).toBe('queued');
    expect(provider.revoked).toEqual([BOB]);

    const { rows } = await pool!.query(
      'select provider_subject, email, status from account_deletions where provider_subject = $1',
      [BOB],
    );
    expect(rows).toHaveLength(1);
    // Kept because step 5 deletes the provider identity after the user row is
    // gone, and step 7 confirms by email.
    expect(rows[0].email).toBe(`${BOB}@mira.local`);
  });

  dbIt('a second request is not a second deletion', async () => {
    const first = await app!.inject({
      method: 'DELETE',
      url: '/v1/auth/account',
      headers: await auth(BOB),
    });
    const second = await app!.inject({
      method: 'DELETE',
      url: '/v1/auth/account',
      headers: await auth(BOB),
    });

    expect(second.statusCode).toBe(202);
    expect(second.json().deletion_id).toBe(first.json().deletion_id);

    const { rows } = await pool!.query(
      'select count(*) as n from account_deletions where provider_subject = $1',
      [BOB],
    );
    expect(Number(rows[0].n)).toBe(1);
  });

  dbIt('records the request even when revoking fails', async () => {
    await pool!.query('delete from account_deletions');
    provider.present = false;

    const res = await app!.inject({
      method: 'DELETE',
      url: '/v1/auth/account',
      headers: await auth(BOB),
    });
    expect(res.statusCode).toBe(503);

    // A deletion the user asked for and Mira forgot is the worst outcome here,
    // so the record is written before the revoke is attempted.
    const { rows } = await pool!.query(
      'select status from account_deletions where provider_subject = $1',
      [BOB],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('queued');
  });

  dbIt('deletes only the caller’s own account', async () => {
    await pool!.query('delete from account_deletions');
    await app!.inject({ method: 'DELETE', url: '/v1/auth/account', headers: await auth(ALICE) });

    const { rows } = await pool!.query('select provider_subject from account_deletions');
    // The subject comes from the verified actor, never from the request.
    expect(rows.map((r) => r.provider_subject)).toEqual([ALICE]);
  });
});
