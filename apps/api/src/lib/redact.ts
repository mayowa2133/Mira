/**
 * Redaction.
 *
 * Applied to EVERY log line, analytics event and error report before it leaves
 * the process. This is the enforcement point for:
 *
 *   SEC-2  authentication and OAuth tokens are never logged
 *   SEC-9  analytics never receives image contents, email content or body data
 *
 * See `docs/07-security/security-rules.md` and
 * `docs/08-engineering/observability.md` — "Never logged".
 *
 * The rule is deliberately conservative: it redacts on KEY NAME, so a new field
 * called `access_token_v2` is redacted the day it is introduced rather than the
 * day someone remembers to add it here.
 */

export const REDACTED = '[redacted]';

/**
 * Key patterns that must never appear in output.
 *
 * Grouped by the rule each one serves, so removing an entry requires
 * confronting the rule it protects.
 */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  // SEC-2 — credentials
  /token/i,
  /secret/i,
  /password/i,
  /passwd/i,
  /credential/i,
  /authorization/i,
  /^auth$/i,
  /api[-_]?key/i,
  /^cookie$/i,
  /session[-_]?id/i,
  /refresh/i,
  /\bjwt\b/i,
  /^code$/i, // OAuth authorization codes
  /signature/i,

  // SEC-9 / privacy — user content
  /image[-_]?(bytes|data|url|base64)/i,
  /storage[-_]?key/i,
  /\bblurhash\b/i,
  /body[-_]?(image|photo|measurement)/i,
  /email[-_]?(body|subject|content|html|text)/i,
  /message[-_]?body/i,
  /\bprompt\b/i,
  /raw[-_]?(text|ocr|content)/i,
  /\bocr[-_]?text\b/i,
  /photo/i,
  /\bupload[-_]?key\b/i,
];

/** Values that are themselves secrets regardless of their key. */
const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
  /^Bearer\s+\S+/i,
  /^eyJ[A-Za-z0-9_-]{10,}\./, // JWT
  /^sk-[A-Za-z0-9_-]{16,}/, // provider API key (e.g. sk-ant-api03-...)
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /^data:image\//i,
];

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((p) => p.test(key));
}

function isSensitiveValue(value: string): boolean {
  return SENSITIVE_VALUE_PATTERNS.some((p) => p.test(value));
}

/**
 * Email addresses are PII. Logs may correlate on an opaque `user_id`, never on
 * an address (`docs/08-engineering/observability.md` — Never logged).
 */
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

function redactString(value: string): string {
  if (isSensitiveValue(value)) return REDACTED;
  return value.replace(EMAIL_RE, REDACTED);
}

const MAX_DEPTH = 8;

/**
 * Deep-redact an arbitrary value.
 *
 * Handles cycles, Errors, Buffers, Maps and Sets, because a redactor that
 * throws on unusual input is a redactor that gets bypassed.
 */
export function redact(input: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') return redactString(input);
  if (typeof input === 'number' || typeof input === 'boolean' || typeof input === 'bigint') {
    return input;
  }
  if (depth >= MAX_DEPTH) return '[truncated]';

  // Raw bytes are never useful in a log and are frequently image data.
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) return REDACTED;
  if (input instanceof Uint8Array) return REDACTED;

  if (input instanceof Error) {
    return {
      name: input.name,
      message: redactString(input.message),
      stack: input.stack ? redactString(input.stack) : undefined,
    };
  }

  if (typeof input === 'object') {
    if (seen.has(input)) return '[circular]';
    seen.add(input);

    if (Array.isArray(input)) return input.map((v) => redact(v, depth + 1, seen));
    if (input instanceof Map) return REDACTED;
    if (input instanceof Set) return REDACTED;

    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? REDACTED : redact(value, depth + 1, seen);
    }
    return out;
  }

  return REDACTED;
}
