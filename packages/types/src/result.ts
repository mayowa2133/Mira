/**
 * A result type for operations that can fail in an expected way.
 *
 * Used where an error is a normal outcome the caller must handle — AI output
 * validation, product matching, duplicate checks — so failure cannot be
 * silently ignored (`docs/08-engineering/coding-standards.md` — Error handling).
 * Unexpected failures still throw.
 */
export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = Error> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => !r.ok;

/** Unwrap, throwing on failure. Use only where failure is genuinely impossible. */
export function unwrap<T, E>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  throw r.error instanceof Error ? r.error : new Error(String(r.error));
}
