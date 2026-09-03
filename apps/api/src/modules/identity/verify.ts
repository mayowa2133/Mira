/**
 * Token verification.
 *
 * Implements `docs/05-api/auth-contract.md` — "Verification on every request":
 *   1. signature and expiry validated against the provider's JWKS (cached)
 *   2. `aud` must match JWT_AUDIENCE
 *   3. the subject resolves to a Mira user_id
 *
 * A request without a resolvable user never reaches a service.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Env } from '../../config/env.js';
import { ApiError, ErrorCode } from '../../http/errors.js';

export type VerifiedToken = {
  subject: string;
  email: string | null;
};

export interface TokenVerifier {
  verify(token: string): Promise<VerifiedToken>;
}

function toVerified(payload: JWTPayload): VerifiedToken {
  const subject = payload.sub;
  if (!subject) throw new ApiError(401, ErrorCode.tokenInvalid);
  const email = typeof payload['email'] === 'string' ? payload['email'] : null;
  return { subject, email };
}

/** Production verifier: remote JWKS, cached and rotated by `jose`. */
export function createJwksVerifier(env: Env): TokenVerifier {
  if (!env.SUPABASE_JWKS_URL) {
    throw new Error('SUPABASE_JWKS_URL is required to build the JWKS verifier');
  }
  const jwks = createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL));

  return {
    async verify(token: string): Promise<VerifiedToken> {
      try {
        const { payload } = await jwtVerify(token, jwks, { audience: env.JWT_AUDIENCE });
        return toVerified(payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (/exp/i.test(message)) throw new ApiError(401, ErrorCode.tokenExpired, { cause: error });
        throw new ApiError(401, ErrorCode.tokenInvalid, { cause: error });
      }
    },
  };
}

/**
 * Local development verifier: HS256 with a shared secret.
 *
 * `loadEnv` refuses to start with DEV_AUTH_SECRET set outside the local
 * environment, so this can never be reached in staging or production.
 */
export function createDevVerifier(env: Env): TokenVerifier {
  const secret = new TextEncoder().encode(env.DEV_AUTH_SECRET ?? 'mira-local-dev-secret');
  return {
    async verify(token: string): Promise<VerifiedToken> {
      try {
        const { payload } = await jwtVerify(token, secret, { audience: env.JWT_AUDIENCE });
        return toVerified(payload);
      } catch (error) {
        throw new ApiError(401, ErrorCode.tokenInvalid, { cause: error });
      }
    },
  };
}

export function createVerifier(env: Env): TokenVerifier {
  if (env.SUPABASE_JWKS_URL) return createJwksVerifier(env);
  if (env.MIRA_ENV === 'local' || env.NODE_ENV === 'test') return createDevVerifier(env);
  // Unreachable: loadEnv already requires JWKS outside local. Belt and braces.
  throw new Error(`no token verifier available for MIRA_ENV=${env.MIRA_ENV}`);
}
