/**
 * The ownership sheet and selection rules (§8, taxonomy §12).
 *
 * React-free: which answers exist, which one puts something in the closet, and
 * what the footer says. The mapping from a human answer to a candidate status
 * is the part worth testing — five phrasings collapse onto nine statuses, and
 * getting one wrong puts a returned coat in someone's wardrobe.
 */
export type OwnershipAnswer = {
  key: string;
  label: string;
  /** taxonomy §12. */
  status: string;
  /** True for exactly one answer (OWN-1). */
  addsToCloset: boolean;
};

/**
 * §8's five answers, in its order.
 *
 * "Sold / donated" maps to `returned` rather than a status of its own: §12 has
 * no `sold` for a CANDIDATE, and the meaning Mira needs is the same one —
 * the purchase happened, the garment is not in the closet. The distinction
 * between returning and selling belongs on a garment someone owns, where
 * taxonomy §10 does have both.
 */
export const OWNERSHIP_ANSWERS: readonly OwnershipAnswer[] = [
  { key: 'own', label: 'Yes — in my closet', status: 'confirmed_owned', addsToCloset: true },
  { key: 'returned', label: 'Returned it', status: 'returned', addsToCloset: false },
  { key: 'sold', label: 'Sold / donated', status: 'returned', addsToCloset: false },
  { key: 'not-mine', label: 'Not mine', status: 'not_mine', addsToCloset: false },
  // Never forces a decision, and keeps the candidate reviewable (§12).
  { key: 'unsure', label: 'Not sure', status: 'uncertain', addsToCloset: false },
];

/** §8's sticky footer. Live, and honest about zero. */
export function footerLabel(selected: number): string {
  if (selected === 0) return 'Select pieces to add';
  return `Add ${selected} ${selected === 1 ? 'item' : 'items'} to my closet`;
}

/** §8's header. */
export function headerLabel(total: number): string {
  if (total === 0) return 'Nothing to review';
  return `We found ${total} ${total === 1 ? 'piece' : 'pieces'}`;
}

export function toggleSelection(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
}

/**
 * Retailer counts for the filter strip.
 *
 * Sorted by count so the retailer someone bought most from is first, which is
 * the one they are most likely to be looking for. Candidates with no retailer
 * are grouped rather than dropped — a purchase Mira could not attribute is
 * still a purchase to review.
 */
export function retailerCounts(
  candidates: readonly { retailer: string | null }[],
): { retailer: string | null; count: number }[] {
  const counts = new Map<string | null, number>();
  for (const c of candidates) counts.set(c.retailer, (counts.get(c.retailer) ?? 0) + 1);

  return [...counts.entries()]
    .map(([retailer, count]) => ({ retailer, count }))
    .sort((a, b) => b.count - a.count || String(a.retailer).localeCompare(String(b.retailer)));
}

/** What a candidate is called on its tile. Never blank, never a raw id. */
export function candidateLabel(candidate: {
  product_name: string | null;
  raw_item_name: string;
  brand: string | null;
}): string {
  const name = candidate.product_name ?? candidate.raw_item_name;
  return [candidate.brand, name].filter(Boolean).join(' ');
}
