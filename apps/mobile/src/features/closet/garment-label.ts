/**
 * What a screen reader hears when it reaches a garment tile.
 *
 * `docs/02-design/accessibility.md` §4: one phrase describing the garment, not
 * four disconnected fragments. Pulled out of the component because it has been
 * wrong three times, each in a way that only showed up on a device:
 *
 *   1. An EMPTY label. iOS falls back to concatenating a view's children when
 *      the label is blank, and the only text in a bare tile is the favourite
 *      heart — so a dress announced itself as "♡".
 *   2. A colour-only label: "black". True, and useless — the listener learns
 *      the colour of something they cannot identify.
 *   3. Both were caused by a garment Mira knows little about, which is the
 *      normal state of a photograph taken thirty seconds ago.
 *
 * So the label always LEADS with what the thing is.
 */

export type LabelInput = {
  brand: string | null | undefined;
  name: string | null | undefined;
  /** Colour and size, already formatted — "black · S". */
  subtitle: string;
  category: string;
  favorite: boolean;
  isAnalyzing: boolean;
};

/**
 * What to call a garment with no brand and no name.
 *
 * Its category, in language — "A pair of shoes" rather than `shoes`. Vague, but
 * true, and it is what a person would say pointing at something across a room.
 */
export function describeUnnamed(category: string): string {
  switch (category) {
    case 'shoes':
      return 'A pair of shoes';
    case 'bags':
      return 'A bag';
    case 'accessories':
      return 'An accessory';
    case 'dresses':
      return 'A dress';
    case 'tops':
      return 'A top';
    case 'bottoms':
      return 'A pair of bottoms';
    case 'outerwear':
      return 'A layer';
    case 'sets':
      return 'A set';
    case 'activewear':
      return 'Activewear';
    case 'swimwear':
      return 'Swimwear';
    default:
      return 'A piece in your closet';
  }
}

export function garmentLabel(input: LabelInput): string {
  const brand = input.brand ?? null;
  const name = input.name ?? null;

  // Whatever identifies the piece: its brand, else its name, else what it is.
  const identity = brand ?? name ?? describeUnnamed(input.category);

  const parts = [
    identity,
    // Only when the brand led, or the name would repeat the identity.
    brand && name ? name : null,
    input.subtitle.trim().length > 0 ? input.subtitle : null,
    input.favorite ? 'Favourited' : null,
    input.isAnalyzing ? 'Still being analyzed' : null,
  ];

  return parts.filter((part): part is string => Boolean(part)).join(', ');
}
