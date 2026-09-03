/**
 * Analytics.
 *
 * Events are defined in `docs/05-api/events.md`. The rules that matter here:
 *
 *   AN-2 / SEC-9 — payloads MUST NOT contain image bytes or URLs, email
 *   content, body data, prompt text, or raw search queries.
 *
 * Enforcement is not left to reviewers: `track()` runs every property through
 * an allowlist AND the redactor, and drops anything that fails. A disallowed
 * property is a bug, so it is reported rather than silently swallowed.
 */
import { isSensitiveKey, redact } from './redact.js';

export type AnalyticsProperties = Record<string, unknown>;

export interface AnalyticsClient {
  track(event: string, userId: string | null, properties?: AnalyticsProperties): void;
  flush(): Promise<void>;
}

/**
 * Property values that are always safe: identifiers, counts, durations,
 * low-cardinality dimensions and booleans.
 *
 * Strings are allowed only when short and free of the shapes that indicate user
 * content — a URL, a data URI, an email address, or a long free-text blob.
 */
const MAX_STRING_LENGTH = 64;
const DISALLOWED_STRING_SHAPES = [/^https?:\/\//i, /^data:/i, /@[\w-]+\.[\w.-]+/, /\s{2,}/];

export function isAllowedProperty(key: string, value: unknown): boolean {
  if (isSensitiveKey(key)) return false;
  if (value === null || value === undefined) return true;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH) return false;
    return !DISALLOWED_STRING_SHAPES.some((re) => re.test(value));
  }
  if (Array.isArray(value)) return value.every((v) => isAllowedProperty(key, v));
  return false;
}

export type SanitizeResult = {
  properties: AnalyticsProperties;
  dropped: string[];
};

export function sanitizeProperties(properties: AnalyticsProperties): SanitizeResult {
  const out: AnalyticsProperties = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(properties)) {
    if (isAllowedProperty(key, value)) out[key] = value;
    else dropped.push(key);
  }
  return { properties: redact(out) as AnalyticsProperties, dropped };
}

export type AnalyticsSink = (payload: {
  event: string;
  userId: string | null;
  properties: AnalyticsProperties;
}) => void;

export function createAnalytics(options: {
  enabled: boolean;
  sink?: AnalyticsSink;
  onDroppedProperty?: (event: string, keys: string[]) => void;
}): AnalyticsClient {
  const queue: { event: string; userId: string | null; properties: AnalyticsProperties }[] = [];

  return {
    track(event, userId, properties = {}) {
      const { properties: safe, dropped } = sanitizeProperties(properties);
      if (dropped.length > 0) {
        // A disallowed property is a bug in the caller, not a runtime condition
        // to tolerate quietly (AN-2).
        options.onDroppedProperty?.(event, dropped);
      }
      if (!options.enabled) return;
      const payload = { event, userId, properties: safe };
      if (options.sink) options.sink(payload);
      else queue.push(payload);
    },
    async flush() {
      queue.length = 0;
    },
  };
}
