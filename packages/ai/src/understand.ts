/**
 * From a model response to something that can be stored.
 *
 * `docs/06-ai/garment-understanding.md` §3, the part after the vision call:
 *
 *   strict JSON parse → schema validation → taxonomy clamp
 *     → confidence normalization → persist with provider, model, confidence
 *
 * The governing rule is §7: a malformed response degrades to category-only, and
 * the garment is never lost (REL-4). So nothing here throws on bad output —
 * every path produces something storable, and says how much to trust it.
 */
import { clampUnderstanding, type ClampedUnderstanding } from './clamp.js';
import { parseStrictJson } from './pipeline.js';
import type { ClampDrop } from '@mira/taxonomy';
import type { RawModelResponse } from './capabilities.js';

export type UnderstandingOutcome =
  /** Parsed and clamped. `drops` may still be non-empty. */
  | { status: 'understood'; value: ClampedUnderstanding; drops: ClampDrop[] }
  /** Unparseable even after a retry: category-only, nothing lost. */
  | { status: 'degraded'; value: ClampedUnderstanding; reason: string };

export type Provenance = {
  provider: string;
  model: string;
  modelVersion: string | null;
};

export function provenanceOf(raw: RawModelResponse): Provenance {
  return {
    provider: raw.provider,
    model: raw.model,
    modelVersion: raw.modelVersion ?? null,
  };
}

/**
 * Interpret one response.
 *
 * Note what is NOT here: no repair of nearly-JSON, no coaxing a value into the
 * taxonomy. Model output is untrusted input (AI-7); the only two outcomes are
 * "this parsed" and "this did not".
 */
export function interpret(text: string): UnderstandingOutcome {
  const parsed = parseStrictJson(text);
  if (!parsed.ok) {
    return {
      status: 'degraded',
      value: clampUnderstanding({}).value,
      reason: `${parsed.failure.reason}: ${parsed.failure.detail}`,
    };
  }

  if (typeof parsed.value !== 'object' || parsed.value === null || Array.isArray(parsed.value)) {
    return {
      status: 'degraded',
      value: clampUnderstanding({}).value,
      reason: 'not_an_object',
    };
  }

  const { value, drops } = clampUnderstanding(parsed.value as Record<string, unknown>);
  return { status: 'understood', value, drops };
}

/**
 * Call the model, and retry ONCE if the answer cannot be parsed.
 *
 * §7: "Model returns invalid JSON → retry once, then fall back to
 * category-only." One retry, not a loop: a model producing prose instead of
 * JSON will usually do it again, and the user is waiting.
 *
 * A clamped-but-parseable answer is NOT retried. It parsed; some of its values
 * were not in the taxonomy, which is information about the model, not a reason
 * to spend the user's time again.
 */
export async function understandWithRetry(
  call: () => Promise<RawModelResponse>,
): Promise<{ outcome: UnderstandingOutcome; provenance: Provenance }> {
  const first = await call();
  const outcome = interpret(first.text);
  if (outcome.status === 'understood') {
    return { outcome, provenance: provenanceOf(first) };
  }

  const second = await call();
  const retried = interpret(second.text);
  return { outcome: retried, provenance: provenanceOf(second) };
}

/**
 * The fields worth storing, with the confidence attached to each.
 *
 * One row per field in `garment_attributes`, because a single overall
 * confidence cannot express "certain it is a dress, guessing at the material" —
 * which is the normal case, and the whole reason the review screen can show a
 * tick on one line and a question on the next.
 *
 * A field the model did not produce is absent rather than null-with-confidence:
 * "no opinion" and "confidently nothing" are different claims.
 */
export type AttributeValue = {
  field: string;
  value: unknown;
  confidence: number;
};

/** Fields that carry their own confidence and belong in provenance. */
const TRACKED_FIELDS = [
  'category',
  'subcategory',
  'brand',
  'product_name',
  'colors',
  'pattern',
  'materials',
  'style',
  'fit',
  'sleeve_length',
  'sleeve_type',
  'neckline',
  'length',
  'season',
  'occasion',
  'size',
] as const;

/**
 * Confidence for a field the model reported nothing about.
 *
 * Zero, not a default — the model expressed no confidence, so neither do we,
 * and the review screen will render it as an empty tappable row rather than a
 * claim (CAP-2).
 */
const NO_CONFIDENCE = 0;

export function toAttributes(understanding: ClampedUnderstanding): AttributeValue[] {
  const out: AttributeValue[] = [];

  for (const field of TRACKED_FIELDS) {
    const value = (understanding as unknown as Record<string, unknown>)[field];

    // Absent is not the same as empty: skip what the model had nothing to say
    // about, rather than recording a confident nothing.
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;

    out.push({
      field,
      value,
      confidence: understanding.confidence[field] ?? NO_CONFIDENCE,
    });
  }

  return out;
}
