/**
 * What the duplicate sheet says, and about which piece
 * (`docs/06-ai/duplicate-detection.md` §4).
 *
 * React-free, because this is the part with judgement in it: whether to
 * interrupt at all, which of several candidates to ask about, and how firmly to
 * put the question. Getting the wording wrong here is what pushes someone into
 * merging two garments they actually own separately.
 */
import { describeUnnamed } from './garment-label';

export type DuplicateBand = 'ask' | 'ask_softly' | 'note';

export type DuplicateCandidate = {
  existing_garment: {
    id: string;
    name: string | null;
    brand: { id: string; name: string } | null;
    brand_raw: string | null;
    category: string;
    primary_color: string | null;
    canonical_image: { thumb_url: string | null; url: string } | null;
  };
  score: number;
  band: DuplicateBand;
  signals: string[];
  summary: string;
};

export type DuplicateRelation = 'same_item' | 'owns_two' | 'different';

/**
 * The candidate to ask about, or nothing.
 *
 * §4 shows ONE pair. Asking about three at once turns a question into a chore,
 * and the answer to the strongest is usually the answer to all of them — a
 * user who says "they're different" about the closest match is not going to say
 * "same item" about a weaker one.
 *
 * `note` never reaches here: below 0.70 Mira does not interrupt mid-capture,
 * it raises it later where browsing is the point (§3).
 */
export function candidateToAskAbout(
  candidates: readonly DuplicateCandidate[],
): DuplicateCandidate | null {
  const asking = candidates.filter((c) => c.band === 'ask' || c.band === 'ask_softly');
  if (asking.length === 0) return null;

  return asking.reduce((best, next) => (next.score > best.score ? next : best));
}

/**
 * The question, pitched to how sure Mira is (§3).
 *
 * The confident band gets the spec's own line. The soft band gets a genuinely
 * open question, because at 0.70–0.899 the most likely truth is that these are
 * two similar garments — the §7 case of "same brand, same colour, different
 * cut" lands here — and a confident-sounding prompt would be leading the
 * witness.
 */
export function headlineFor(band: DuplicateBand): string {
  return band === 'ask' ? 'This may already be in your closet.' : 'Is this one you already own?';
}

/** How a garment reads on the two comparison lines of §4. */
export function describeGarment(garment: {
  name: string | null;
  brand: { name: string } | null;
  brand_raw: string | null;
  category: string;
  primary_color: string | null;
}): string {
  const brand = garment.brand?.name ?? garment.brand_raw;
  const identity = [brand, garment.name].filter(Boolean).join(' ');

  const named = identity.length > 0 ? identity : describeUnnamed(garment.category);
  return garment.primary_color ? `${named} — ${titleCase(garment.primary_color)}` : named;
}

/**
 * The three answers (§4).
 *
 * "I own two" comes first among the creating options because Mira must support
 * legitimate duplicate ownership (§1) — owning two identical black bodysuits is
 * normal, and burying that choice would make the normal case feel like the
 * exception.
 *
 * Merging is destructive in the sense that matters: it is the one answer that
 * cannot be undone by deleting a garment afterwards, so it is not the default
 * and it is not styled as the primary action.
 */
export const CHOICES: readonly { relation: DuplicateRelation; label: string }[] = [
  { relation: 'same_item', label: "It's the same item" },
  { relation: 'owns_two', label: 'I own two' },
  { relation: 'different', label: "They're different" },
];

/** What happens if this is chosen, said plainly before it is chosen. */
export function consequenceOf(relation: DuplicateRelation): string {
  switch (relation) {
    case 'same_item':
      return 'Mira will add anything new to the piece you already have. Nothing is lost.';
    case 'owns_two':
      return "You'll have both, and Mira won't ask about this pair again.";
    case 'different':
      return "You'll have both, and Mira will remember these aren't the same.";
  }
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
