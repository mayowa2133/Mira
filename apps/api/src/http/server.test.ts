import { SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from './server.js';
import { loadEnv } from '../config/env.js';
import { createDevVerifier } from '../modules/identity/verify.js';
import { createLogger } from '../lib/logger.js';

const SECRET = 'test-secret-for-local-verification';

const testEnv = loadEnv({
  NODE_ENV: 'test',
  MIRA_ENV: 'local',
  LOG_LEVEL: 'fatal',
  DEV_AUTH_SECRET: SECRET,
  JWT_AUDIENCE: 'mira',
} as NodeJS.ProcessEnv);

async function signToken(subject: string, options: { audience?: string; expired?: boolean } = {}) {
  const jwt = new SignJWT({ email: `${subject}@mira.local` })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setAudience(options.audience ?? 'mira')
    .setIssuedAt();
  return options.expired
    ? jwt.setExpirationTime('-1h').sign(new TextEncoder().encode(SECRET))
    : jwt.setExpirationTime('1h').sign(new TextEncoder().encode(SECRET));
}

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildServer({
    env: testEnv,
    verifier: createDevVerifier(testEnv),
    logger: createLogger({ level: 'fatal', sink: () => undefined }),
    checkDependencies: async () => ({ database: true, queue: true, storage: true }),
  });
});

afterAll(async () => {
  await app.close();
});

describe('health', () => {
  it('reports liveness without authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('reports readiness when dependencies are reachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ready', database: true });
  });

  it('returns 503 when a dependency is unreachable, so deploys are gated', async () => {
    const degraded = await buildServer({
      env: testEnv,
      verifier: createDevVerifier(testEnv),
      logger: createLogger({ level: 'fatal', sink: () => undefined }),
      checkDependencies: async () => ({ database: false, queue: true, storage: true }),
    });
    const res = await degraded.inject({ method: 'GET', url: '/v1/health/ready' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'not_ready', database: false });
    await degraded.close();
  });
});

describe('authentication (docs/05-api/auth-contract.md)', () => {
  it('rejects a request with no token', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/auth/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('unauthenticated');
  });

  it('rejects a malformed authorization header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: 'NotBearer abc' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('attacker')
      .setAudience('mira')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('wrong-secret'));
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${forged}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('token_invalid');
  });

  it('rejects an expired token', async () => {
    const token = await signToken('user-1', { expired: true });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a token for the wrong audience', async () => {
    const token = await signToken('user-1', { audience: 'someone-else' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
  });
});

/**
 * Regression: `actor.userId` must be the MIRA user id, never the identity
 * provider's subject.
 *
 * These are different namespaces — the provider's subject is an opaque string,
 * a Mira user id is a uuid — and every repository call is scoped by the latter
 * (SEC-5, docs/05-api/auth-contract.md). Conflating them made every scoped
 * query fail with `invalid input syntax for type uuid`, and would have been far
 * worse had the column been text.
 */
describe('actor resolution (SEC-5)', () => {
  const MIRA_ID = '99999999-9999-9999-9999-999999999999';

  it('resolves the provider subject to a Mira user id before any route runs', async () => {
    let seen: { userId: string; providerSubject: string } | null = null;

    const server = await buildServer({
      env: testEnv,
      verifier: createDevVerifier(testEnv),
      logger: createLogger({ level: 'fatal', sink: () => undefined }),
      checkDependencies: async () => ({ database: true, queue: true, storage: true }),
      userResolver: {
        async resolve(providerSubject, email) {
          return { userId: MIRA_ID, providerSubject, email };
        },
      },
    });

    server.get('/v1/__actor', async (request) => {
      seen = {
        userId: request.actor?.userId ?? '',
        providerSubject: request.actor?.providerSubject ?? '',
      };
      return { ok: true };
    });

    const jwt = await signToken('provider-subject-not-a-uuid');
    await server.inject({
      method: 'GET',
      url: '/v1/__actor',
      headers: { authorization: `Bearer ${jwt}` },
    });

    expect(seen).not.toBeNull();
    expect(seen!.userId).toBe(MIRA_ID);
    expect(seen!.providerSubject).toBe('provider-subject-not-a-uuid');
    // The two must never be the same value by accident.
    expect(seen!.userId).not.toBe(seen!.providerSubject);

    await server.close();
  });
});

describe('error contract (docs/05-api/error-contract.md)', () => {
  it('returns the documented error shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/auth/me' });
    const body = res.json();
    expect(body).toHaveProperty('error.code');
    expect(body).toHaveProperty('error.message');
    expect(body).toHaveProperty('error.request_id');
    expect(body).toHaveProperty('error.retry_after');
  });

  it('never leaks a stack trace or provider text in the message', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/auth/me' });
    const message: string = res.json().error.message;
    expect(message).not.toMatch(/at \w+ \(/);
    expect(message).not.toMatch(/Error:/);
    expect(message).toBe('Please sign in again.');
  });

  it('returns 404 for an unknown route', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty('error.code');
  });

  it('carries a request id on every error, for support', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/nope' });
    expect(res.json().error.request_id).toMatch(/^req_/);
  });
});
