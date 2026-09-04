/**
 * Combining signals into a score, and a score into a behaviour
 * (`docs/06-ai/duplicate-detection.md` §2–§4).
 */
import {
  SIGNAL_STRENGTH,
  signalsBetween,
  type DuplicateSignal,
  type DuplicateSubject,
  type SignalStrength,
} from './signals.js';

/**
 * What Mira does with a score (§3).
 *
 * Named for the behaviour rather than the number, because the number is an
 * implementation detail and the behaviour is the product:
 *
 * | Band         | Score        | Behaviour                                     |
 * | ------------ | ------------ | --------------------------------------------- |
 * | `ask`        | ≥ 0.90       | Show the duplicate sheet before saving         |
 * | `ask_softly` | 0.70–0.899   | Show the sheet, worded more softly             |
 * | `note`       | 0.50–0.699   | Save silently; surface later in insights (9.2) |
 * | `ignore`     | < 0.50       | Save silently                                  |
 */
export type DuplicateBand = 'ask' | 'ask_softly' | 'note' | 'ignore';

export const ASK_THRESHOLD = 0.9;
export const ASK_SOFTLY_THRESHOLD = 0.7;
export const NOTE_THRESHOLD = 0.5;

export function bandFor(score: number): DuplicateBand {
  if (score >= ASK_THRESHOLD) return 'ask';
  if (score >= ASK_SOFTLY_THRESHOLD) return 'ask_softly';
  if (score >= NOTE_THRESHOLD) return 'note';
  return 'ignore';
}

/** Any decisive signal "short-circuits to a high score" (§2). */
export const DECISIVE_SCORE = 0.99;

/**
 * Signal weights, derived from the thresholds rather than chosen.
 *
 * Each weight is the score its signal reaches on its own, and each of those is
 * fixed by the band §2 and §3 together say that signal alone belongs in:
 *
 * - **strong** (0.72) — a near-identical photograph, or the same brand with a
 *   very similar name. On its own this is a real signal and §3 says to ask,
 *   softly. It must clear 0.70 and must not reach 0.90, because one strong
 *   signal is a question, not a verdict.
 * - **moderate** (0.55) — same brand, colour, size and category. This is the
 *   deliberately hard case from §7: "same brand, same colour, different cut" is
 *   exactly where a false merge is most damaging, so alone it must NOT
 *   interrupt. It lands in `note` and is raised later, while browsing.
 * - **weak** (0.15) — purchase dates within three days. "Supporting signal
 *   only": it must stay below `note` on its own so it can never surface
 *   anything by itself.
 *
 * Visual embedding similarity, when Phase 5 supplies it, is moderate: alone it
 * reaches `note` and never interrupts, which is what "never sufficient alone"
 * means in behaviour rather than in prose.
 */
export const SIGNAL_WEIGHT: Record<Exclude<SignalStrength, 'decisive'>, number> = {
  strong: 0.72,
  moderate: 0.55,
  weak: 0.15,
};

/**
 * Combine independent evidence.
 *
 * Noisy-OR — `1 − Π(1 − wᵢ)` — rather than a sum, for two reasons. It cannot
 * exceed 1, so weights never need clamping into a shape that hides what they
 * mean. And it is monotonic and saturating: adding a weak signal to a strong
 * one nudges it, while two strong signals compound into the `ask` band
 * (1 − 0.28² = 0.922) exactly as §2's "weighted combination" intends.
 *
 * The one property to hold onto: every signal can only ever raise the score.
 * Absent evidence is not evidence of difference.
 */
export function combine(signals: readonly DuplicateSignal[]): number {
  if (signals.some((signal) => SIGNAL_STRENGTH[signal] === 'decisive')) return DECISIVE_SCORE;

  let remaining = 1;
  for (const signal of signals) {
    const strength = SIGNAL_STRENGTH[signal];
    if (strength === 'decisive') continue;
    remaining *= 1 - SIGNAL_WEIGHT[strength];
  }

  // Three decimals, which is what garment_duplicates.detector_score stores.
  return Math.round((1 - remaining) * 1000) / 1000;
}

/**
 * User-facing copy for the signals that fired (§4: "The signals that fired are
 * summarized in one line").
 *
 * Written as things a person would say about two garments, never as signal
 * names. The user is being asked to make a judgement, and "brand_name" tells
 * them nothing about the two pictures in front of them.
 */
const PHRASE: Record<DuplicateSignal, string> = {
  barcode: 'The same barcode',
  sku_retailer: 'The same item from the same shop',
  product_url: 'The same product page',
  order_line: 'From the same order',
  image_hash: 'Nearly the same photograph',
  brand_name: 'Same brand and a very similar name',
  category_color_size_brand: 'Same brand, colour and size',
  purchase_window: 'Bought within a few days of each other',
};

/** Strongest first, so the line leads with the reason that carries the weight. */
const ORDER: Record<SignalStrength, number> = {
  decisive: 0,
  strong: 1,
  moderate: 2,
  weak: 3,
};

export function summarize(signals: readonly DuplicateSignal[]): string {
  const ranked = [...signals].sort((a, b) => ORDER[SIGNAL_STRENGTH[a]] - ORDER[SIGNAL_STRENGTH[b]]);
  const first = ranked[0];
  if (!first) return '';

  // A decisive signal settles it; listing what else happened to agree only
  // dilutes a line the user reads in one glance.
  if (SIGNAL_STRENGTH[first] === 'decisive') return PHRASE[first];

  const second = ranked[1];
  return second ? `${PHRASE[first]} · ${PHRASE[second]}` : PHRASE[first];
}

export type DuplicateMatch = {
  signals: DuplicateSignal[];
  score: number;
  band: DuplicateBand;
  summary: string;
};

/** Score one pair. */
export function compare(a: DuplicateSubject, b: DuplicateSubject): DuplicateMatch {
  const signals = signalsBetween(a, b);
  const score = combine(signals);
  return { signals, score, band: bandFor(score), summary: summarize(signals) };
}

export type ScoredCandidate = DuplicateMatch & { garmentId: string };

/**
 * Score a new garment against everything it might already be.
 *
 * Candidates without an id are skipped rather than scored: a match the caller
 * cannot then act on is worse than no match, because it would show the user a
 * sheet with no other garment in it.
 *
 * Results are ordered by score, highest first, so the caller can take the head
 * without re-sorting — the sheet asks about one garment (§4).
 */
export function scoreAgainst(
  subject: DuplicateSubject,
  candidates: readonly DuplicateSubject[],
  options: { minScore?: number } = {},
): ScoredCandidate[] {
  const minScore = options.minScore ?? NOTE_THRESHOLD;

  const scored: ScoredCandidate[] = [];
  for (const candidate of candidates) {
    if (!candidate.id) continue;
    // Comparing a garment with itself fires every signal there is.
    if (subject.id && candidate.id === subject.id) continue;

    const match = compare(subject, candidate);
    if (match.score < minScore) continue;
    scored.push({ ...match, garmentId: candidate.id });
  }

  return scored.sort((a, b) => b.score - a.score);
}
