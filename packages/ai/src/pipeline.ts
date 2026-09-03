/**
 * The validation pipeline every AI response passes through.
 *
 *   parse -> schema validation -> taxonomy clamp -> confidence normalization
 *
 * These steps are non-negotiable. AI output is untrusted input (AI-7), and
 * invalid output is REJECTED, not coerced
 * (`docs/03-architecture/ai-architecture.md` §3).
 */
import type { ZodType } from 'zod';
import type { ClampDrop } from '@mira/taxonomy';
import { normalizeConfidence } from '@mira/taxonomy';

/** Why a response was rejected. Drives the `ai_validation_failed` event. */
export type ValidationFailure =
  | { reason: 'parse'; detail: string }
  | { reason: 'schema'; detail: string }
  | { reason: 'empty'; detail: string };

export type Validated<T> =
  | { ok: true; value: T; drops: ClampDrop[]; raw: unknown }
  | { ok: false; failure: ValidationFailure; raw: unknown };

/**
 * Parse a provider response as strict JSON.
 *
 * No markdown fences, no prose around the object, no regex rescue
 * (`docs/06-ai/prompts.md` §6 — Anti-patterns).
 */
export function parseStrictJson(text: string): Validated<unknown> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, failure: { reason: 'empty', detail: 'empty response' }, raw: text };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed), drops: [], raw: text };
  } catch (error) {
    return {
      ok: false,
      failure: { reason: 'parse', detail: error instanceof Error ? error.message : 'invalid JSON' },
      raw: text,
    };
  }
}

/** Validate parsed output against its contract. */
export function validate<T>(schema: ZodType<T>, value: unknown): Validated<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    return {
      ok: false,
      failure: {
        reason: 'schema',
        detail: result.error.issues
          .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('; '),
      },
      raw: value,
    };
  }
  return { ok: true, value: result.data, drops: [], raw: value };
}

/** Parse and validate in one step — the normal entry point. */
export function parseAndValidate<T>(schema: ZodType<T>, text: string): Validated<T> {
  const parsed = parseStrictJson(text);
  if (!parsed.ok) return parsed;
  return validate(schema, parsed.value);
}

/**
 * Normalize every confidence value into [0,1], dropping non-numeric entries.
 *
 * Never fabricate certainty: an absent or unusable confidence means the field is
 * unknown, not that it is trustworthy (AI-1, R2).
 */
export function normalizeConfidenceMap(input: unknown): Record<string, number> {
  if (typeof input !== 'object' || input === null) return {};
  const out: Record<string, number> = {};
  for (const [field, value] of Object.entries(input as Record<string, unknown>)) {
    const normalized = normalizeConfidence(value);
    if (normalized !== null) out[field] = normalized;
  }
  return out;
}

/**
 * Resolve short candidate ids back to real garment ids, rejecting any id the
 * server did not offer.
 *
 * A model cannot name a garment the user does not own, because it can only emit
 * ids from a set the server built — and this check enforces it (AI-6). The
 * outfit-generation gate for hallucinated garments is 0.00
 * (`docs/06-ai/evaluation.md`).
 */
export function resolveCandidateIds<TItem extends { garment_id: string }>(
  items: TItem[],
  candidates: ReadonlyMap<string, string>,
):
  | { ok: true; items: (TItem & { resolvedGarmentId: string })[] }
  | { ok: false; unknownId: string } {
  const resolved: (TItem & { resolvedGarmentId: string })[] = [];
  for (const item of items) {
    const garmentId = candidates.get(item.garment_id);
    if (!garmentId) return { ok: false, unknownId: item.garment_id };
    resolved.push({ ...item, resolvedGarmentId: garmentId });
  }
  return { ok: true, items: resolved };
}
