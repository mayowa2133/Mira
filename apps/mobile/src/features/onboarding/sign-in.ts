/**
 * Sign-in options (`docs/02-design/screen-specs.md` §4).
 *
 * The provider SDKs are the missing half of task 0.5. Apple and Google need
 * native modules and a configured Supabase project; email needs a magic link
 * with somewhere to send it. None of that exists yet, so this module says so
 * out loud rather than wiring buttons to nothing.
 *
 * SEC-1 is why there is no password option here and never will be one: Mira
 * stores no password in any form, and if a password flow is ever added it is
 * handled entirely by the managed provider.
 */
export type SignInMethod = 'apple' | 'google' | 'email';

export const SIGN_IN_METHODS: { key: SignInMethod; label: string }[] = [
  // Apple first: required on iOS when other social sign-in is offered
  // (auth-contract.md — Providers).
  { key: 'apple', label: 'Continue with Apple' },
  { key: 'google', label: 'Continue with Google' },
  { key: 'email', label: 'Continue with email' },
];

export class SignInUnavailable extends Error {
  constructor(readonly method: SignInMethod) {
    super('sign-in is not connected yet');
    this.name = 'SignInUnavailable';
  }
}

/**
 * What the user is told when a method cannot run.
 *
 * §4: errors appear inline beneath the tapped option, never as a system alert.
 * The copy names the situation without blaming them and without leaking that
 * the cause is a missing configuration key.
 */
export function describeSignInFailure(error: unknown): string {
  if (error instanceof SignInUnavailable) {
    return "Sign-in isn't connected yet. Everything else works without an account.";
  }
  return "That didn't work. Try again?";
}

export interface SignInClient {
  start(method: SignInMethod): Promise<void>;
}

/** The client until a provider is configured. Every method refuses. */
export function createUnavailableSignIn(): SignInClient {
  return { start: (method) => Promise.reject(new SignInUnavailable(method)) };
}
