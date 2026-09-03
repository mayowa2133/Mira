import { Screen, EmptyState } from '@/ui/Screen';

/**
 * Looks (`docs/02-design/screen-specs.md` §22).
 *
 * Pinterest-style masonry with Saved / Worn / Mira / Mine tabs, from Phase 6.
 */
export default function LooksScreen() {
  return (
    <Screen title="Looks">
      <EmptyState
        message="No saved looks yet."
        hint="Ask Mira for a look once your closet has a few pieces."
      />
    </Screen>
  );
}
