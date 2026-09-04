/**
 * API client.
 *
 * The only place the mobile app talks to Mira. Errors are mapped to the error
 * contract (`docs/05-api/error-contract.md`) so screens can render the right
 * state rather than guessing from a status code.
 */
import Constants from 'expo-constants';

const BASE_URL =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  'http://localhost:4000';

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: { field: string; issue: string }[];
    request_id: string;
    retry_after: number | null;
  };
};

/**
 * A failed request, carrying the contract's code and user-presentable message.
 *
 * The message comes from the server, which owns the copy. Screens never invent
 * error text, and never show a raw code (`docs/05-api/error-contract.md`).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null = null,
    readonly retryAfter: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Offline and timeouts are retryable; validation and 404 are not. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }

  get isOffline(): boolean {
    return this.status === 0;
  }
}

let authToken: string | null = null;

/** Tokens live in the keychain; this is the in-memory handle for the session. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

export type RequestOptions = {
  // PUT is a full replacement, which the preferences endpoints use: they
  // are small, wholly replaceable, and a partial update cannot be checked for
  // contradiction against the fields it did not send.
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Required on every creating POST (`docs/05-api/api-contract.md`). */
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (authToken) headers.authorization = `Bearer ${authToken}`;
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/v1${path}`, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    // Status 0 means the request never reached the server: offline, DNS, or a
    // dropped connection. The closet stays browsable from cache (REL-1).
    throw new ApiError(
      0,
      'offline',
      "You're offline. We'll finish this when you're back.",
      null,
      null,
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const parsed: unknown = text ? safeJson(text) : null;

  if (!response.ok) {
    const body = parsed as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'internal',
      body?.error?.message ?? 'Something went wrong on our side.',
      body?.error?.request_id ?? null,
      body?.error?.retry_after ?? null,
    );
  }

  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Build a query string, dropping empty values and expanding arrays. */
export function toQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.append(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}
