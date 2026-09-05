/**
 * The multi-item confirmation list (§11, task 4.5).
 *
 * ```text
 * We found 4 possible items
 * ☑ Black Mini Dress — Zara      $49.99
 * ...
 * Show all lines (2 hidden)
 * [ Add 4 items ]
 * ```
 *
 * React-free, because the interesting rules are which lines are hidden and
 * what the totals say — and a receipt's hidden lines are where tax, shipping
 * and a loyalty discount live, none of which are garments.
 */
export type ReceiptLine = {
  id: string;
  /** Verbatim from the receipt. */
  rawText: string;
  productName: string | null;
  price: number | null;
  /** Mira's confidence that this line is a garment at all. */
  isGarment: boolean;
};

/**
 * Lines shown by default.
 *
 * Only what Mira believes is a garment. Everything else — subtotal, tax,
 * shipping, a discount line — is still listed behind "Show all lines", because
 * a receipt that hid part of itself would be impossible to reconcile against
 * the paper version in someone's hand.
 */
export function visibleLines(lines: readonly ReceiptLine[], showAll: boolean): ReceiptLine[] {
  return showAll ? [...lines] : lines.filter((l) => l.isGarment);
}

export function hiddenCount(lines: readonly ReceiptLine[]): number {
  return lines.filter((l) => !l.isGarment).length;
}

export function showAllLabel(hidden: number): string | null {
  if (hidden === 0) return null;
  return `Show all lines (${hidden} hidden)`;
}

export function foundLabel(count: number): string {
  if (count === 0) return "We couldn't find any items";
  return `We found ${count} possible ${count === 1 ? 'item' : 'items'}`;
}

export function addLabel(selected: number): string {
  if (selected === 0) return 'Select items to add';
  return `Add ${selected} ${selected === 1 ? 'item' : 'items'}`;
}

/**
 * Does the receipt add up?
 *
 * Task 4.4's totals reconciliation, in the form the confirmation list needs:
 * if the garment lines plus the non-garment lines do not reach the printed
 * total, something was missed — and saying so is better than silently
 * importing three of four items.
 *
 * Returns null when there is nothing to check against, which is not a
 * discrepancy.
 */
export function reconcile(
  lines: readonly ReceiptLine[],
  total: number | null,
): { balanced: boolean; difference: number } | null {
  if (total === null) return null;

  const summed = lines.reduce((sum, line) => sum + (line.price ?? 0), 0);
  const difference = Math.round((total - summed) * 100) / 100;

  // A cent of rounding is not a missing item.
  return { balanced: Math.abs(difference) < 0.02, difference };
}

export function reconciliationNote(
  result: { balanced: boolean; difference: number } | null,
): string | null {
  if (!result || result.balanced) return null;
  // Never accusatory, and never silent: it says what to do next.
  return result.difference > 0
    ? `The lines add up to ${result.difference.toFixed(2)} less than the total. Some may be missing — check the full list.`
    : `The lines add up to ${Math.abs(result.difference).toFixed(2)} more than the total.`;
}
