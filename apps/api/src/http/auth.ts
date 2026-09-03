/**
 * Authentication and authorization plumbing.
 *
 * Resolves a bearer token to an `Actor`, and hands services a `UserScope` that
 * every repository call requires (SEC-5).
 *
 * V1 has exactly one role: owner. A user can read and write their own data and
 * nothing else (`docs/05-api/auth-contract.md` — Authorization model).
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { UserScope } from '../db/scope.js';
import { userScope } from '../db/scope.js';
import { ApiError, ErrorCode } from './errors.js';

export type Actor = { userId: string; email: string | null };

declare module 'fastify' {
  interface FastifyRequest {
    actor?: Actor;
  }
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

/**
 * Require an authenticated actor.
 *
 * A request without a resolvable user never reaches a service
 * (`docs/05-api/auth-contract.md`).
 */
export function requireActor(request: FastifyRequest): Actor {
  if (!request.actor) throw new ApiError(401, ErrorCode.unauthenticated);
  return request.actor;
}

/** The proof-of-scope every repository method demands. */
export function requireScope(request: FastifyRequest): UserScope {
  return userScope(requireActor(request).userId);
}

/** Route-level guard, registered as an `onRequest` hook on protected routes. */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  requireActor(request);
}
