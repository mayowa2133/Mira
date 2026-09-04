/**
 * Style preferences (task 11.1, `docs/04-data/database-schema.md`).
 *
 * The values are taxonomy members, and the taxonomy is never widened from
 * application code (INV-1) — so validation happens here, against
 * `@mira/taxonomy`, and the database is left free of a third copy that could
 * drift from it.
 */
import { COLORS, STYLE_TAGS } from '@mira/taxonomy';
import { ApiError, ErrorCode, validationFailed } from '../../http/errors.js';

export type StylePreferences = {
  preferred_styles: string[];
  avoided_styles: string[];
  preferred_colors: string[];
  avoided_colors: string[];
};

export const EMPTY_PREFERENCES: StylePreferences = {
  preferred_styles: [],
  avoided_styles: [],
  preferred_colors: [],
  avoided_colors: [],
};

/** How many of each a user may set. */
const MAX_PER_FIELD = 20;

function assertMembers(field: string, values: string[], allowed: readonly string[]): void {
  const unknown = values.filter((value) => !allowed.includes(value));
  if (unknown.length > 0) {
    throw new ApiError(422, ErrorCode.notInTaxonomy, {
      details: unknown.map((value) => ({ field, issue: `"${value}" is not in the taxonomy` })),
    });
  }
}

/**
 * Validate a full replacement.
 *
 * PUT rather than PATCH, per the contract, so this always sees the complete
 * intended state — which is what makes the contradiction check meaningful:
 * a partial update could add "minimal" to preferred while "minimal" sat in
 * avoided from an earlier request, and neither request would look wrong on its
 * own.
 */
export function validatePreferences(input: StylePreferences): StylePreferences {
  assertMembers('preferred_styles', input.preferred_styles, STYLE_TAGS);
  assertMembers('avoided_styles', input.avoided_styles, STYLE_TAGS);
  assertMembers('preferred_colors', input.preferred_colors, COLORS);
  assertMembers('avoided_colors', input.avoided_colors, COLORS);

  for (const [field, values] of Object.entries(input)) {
    if (values.length > MAX_PER_FIELD) {
      throw validationFailed([{ field, issue: `at most ${MAX_PER_FIELD}` }]);
    }
    if (new Set(values).size !== values.length) {
      throw validationFailed([{ field, issue: 'contains a duplicate' }]);
    }
  }

  // Wanting and avoiding the same thing is not a preference, it is a
  // contradiction — and the stylist would have to silently pick a side.
  const styleClash = input.preferred_styles.filter((s) => input.avoided_styles.includes(s));
  if (styleClash.length > 0) {
    throw validationFailed(
      styleClash.map((value) => ({
        field: 'avoided_styles',
        issue: `"${value}" is both preferred and avoided`,
      })),
    );
  }

  const colorClash = input.preferred_colors.filter((c) => input.avoided_colors.includes(c));
  if (colorClash.length > 0) {
    throw validationFailed(
      colorClash.map((value) => ({
        field: 'avoided_colors',
        issue: `"${value}" is both preferred and avoided`,
      })),
    );
  }

  return input;
}
