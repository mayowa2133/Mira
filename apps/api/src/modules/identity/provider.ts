/**
 * The managed identity provider (`docs/05-api/auth-contract.md`).
 *
 * > Managed authentication (Supabase Auth or equivalent).
 *
 * The provider owns tokens: it issues them, rotates refresh tokens, detects
 * reuse and invalidates families. Mira owns the user record and nothing else
 * about the session. That division is the whole point of "managed" — a
 * hand-rolled rotating-refresh implementation is where session security bugs
 * live, and task 0.5 asks for managed auth rather than for one.
 *
 * This interface is the seam. `SUPABASE_URL` is unset locally, so the endpoints
 * that genuinely need the provider say so rather than pretending: an operation
 * that cannot reach a provider must fail loudly, because a sign-out that
 * silently does not revoke is worse than one that errors.
 */
export interface IdentityProvider {
  /** Human name, for diagnostics. Never a secret. */
  readonly name: string;

  /**
   * Exchange a refresh token for a new pair.
   *
   * The refresh token rotates and is single-use; reuse invalidates the whole
   * family. That is enforced BY THE PROVIDER, which is why this delegates
   * rather than reimplements.
   */
  refresh(refreshToken: string): Promise<ProviderSession>;

  /** Revoke every session for this subject. Sign-out, and step 2 of deletion. */
  revokeSessions(providerSubject: string): Promise<void>;

  /** Step 5 of `data-retention.md` — delete the identity itself. */
  deleteIdentity(providerSubject: string): Promise<void>;
}

export type ProviderSession = {
  accessToken: string;
  refreshToken: string;
  /** ISO 8601. */
  expiresAt: string;
};

/**
 * The provider is not configured.
 *
 * Thrown rather than returned so no caller can mistake "we could not revoke"
 * for "revoked".
 */
export class ProviderUnavailable extends Error {
  constructor(operation: string) {
    super(`no identity provider is configured, so ${operation} cannot be performed`);
    this.name = 'ProviderUnavailable';
  }
}

/**
 * Local development.
 *
 * Every operation fails. That is the correct behaviour, not a gap to be filled
 * with a no-op: a stub that returned success for `revokeSessions` would make
 * sign-out look tested while revoking nothing, and the test proving it would be
 * asserting a lie.
 */
export function createUnconfiguredProvider(): IdentityProvider {
  return {
    name: 'unconfigured',
    refresh: () => Promise.reject(new ProviderUnavailable('refresh')),
    revokeSessions: () => Promise.reject(new ProviderUnavailable('sign-out')),
    deleteIdentity: () => Promise.reject(new ProviderUnavailable('identity deletion')),
  };
}
