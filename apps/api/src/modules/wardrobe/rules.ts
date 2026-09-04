/**
 * What counts as an insight, and when there is not enough closet to say it.
 *
 * Phase 9's exit criteria are unusual in being about restraint:
 *
 *   - No screen in this phase reads as a dashboard.
 *   - Insights degrade gracefully on a small or new closet.
 *
 * The second is the one with teeth. "1 piece deserves another chance" is not an
 * insight, it is a sentence about a wardrobe of four things — and telling
 * someone who joined last week that they never wear their clothes is both
 * useless and faintly rude. So every rule here can decline to say anything, and
 * declining is the normal outcome for a new closet.
 */

/** The threshold the search chip already uses: "Not worn in 90 days". */
export const FORGOTTEN_DAYS = 90;

/**
 * A piece bought recently is not forgotten, it is new.
 *
 * Without this, everything added in the last three months and not yet worn
 * would be reported as neglected the day the user finished importing.
 */
export const SETTLING_IN_DAYS = 30;

/** Below this, a closet has not told us enough to draw conclusions from. */
export const MIN_CLOSET_FOR_INSIGHTS = 12;

/** An insight with fewer items than this is an anecdote. */
export const MIN_ITEMS_PER_INSIGHT = 2;

/** How many wears make a "most loved" piece meaningful rather than accidental. */
export const MIN_WEARS_FOR_MOST_LOVED = 3;

export type InsightKind =
  | 'forgotten'
  | 'never_worn'
  | 'tags_attached'
  | 'most_loved';

export type InsightInput = {
  kind: InsightKind;
  itemCount: number;
  /** For `most_loved`: how many times the top piece was worn. */
  topWearCount?: number;
};

export type InsightVerdict =
  | { show: true }
  | { show: false; reason: 'closet_too_small' | 'not_enough_items' | 'not_enough_signal' };

/**
 * Should this insight be shown at all?
 *
 * Returns a reason when not, because "we had nothing to say" and "we had
 * something and suppressed it" are different, and the difference matters when
 * a screen looks emptier than expected.
 */
export function shouldShow(closetSize: number, input: InsightInput): InsightVerdict {
  if (closetSize < MIN_CLOSET_FOR_INSIGHTS) {
    return { show: false, reason: 'closet_too_small' };
  }

  if (input.kind === 'most_loved') {
    // One wear does not make a favourite; it makes a Tuesday.
    if ((input.topWearCount ?? 0) < MIN_WEARS_FOR_MOST_LOVED) {
      return { show: false, reason: 'not_enough_signal' };
    }
    return input.itemCount >= 1 ? { show: true } : { show: false, reason: 'not_enough_items' };
  }

  if (input.itemCount < MIN_ITEMS_PER_INSIGHT) {
    return { show: false, reason: 'not_enough_items' };
  }

  return { show: true };
}

/**
 * The headline for an insight.
 *
 * Written as observations rather than instructions — the spec calls this screen
 * "fashion content, not a dashboard", and a dashboard is what you get when
 * every card tells the user to do something.
 */
export function headlineFor(kind: InsightKind, count: number): string {
  switch (kind) {
    case 'forgotten':
      return `${count} ${count === 1 ? 'piece deserves' : 'pieces deserve'} another chance`;
    case 'never_worn':
      return "You've never worn these 👀";
    case 'tags_attached':
      return count === 1 ? 'One piece still has its tags' : `${count} pieces still have their tags`;
    case 'most_loved':
      return 'Your most-loved piece';
  }
}

/**
 * Cost per wear, or null when the number would be a lie.
 *
 * A piece worn zero times has no cost per wear — reporting its full price is
 * arithmetically true and reads as an accusation. It is left out until it has
 * been worn.
 */
export function costPerWear(price: number | null, wornCount: number): number | null {
  if (price === null || price <= 0) return null;
  if (wornCount <= 0) return null;
  return Math.round((price / wornCount) * 100) / 100;
}

/**
 * Closet value from the prices that are known.
 *
 * Reports how many pieces it could see, because "your closet is worth £480" is
 * a very different claim depending on whether that covers 12 pieces or 200.
 */
export function closetValue(prices: (number | null)[]): {
  total: number;
  priced: number;
  unpriced: number;
} {
  let total = 0;
  let priced = 0;
  let unpriced = 0;

  for (const price of prices) {
    if (price === null || price <= 0) {
      unpriced += 1;
      continue;
    }
    total += price;
    priced += 1;
  }

  return { total: Math.round(total * 100) / 100, priced, unpriced };
}
