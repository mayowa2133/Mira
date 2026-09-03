import { Screen, EmptyState } from '@/ui/Screen';

/**
 * Closet (`docs/02-design/screen-specs.md` §14).
 *
 * Two columns, never three (D-009). The grid, filters and search arrive in
 * Phases 1 and 5.
 */
export default function ClosetScreen() {
  return (
    <Screen title="Closet" subtitle="0 pieces">
      <EmptyState
        message="Your closet is empty."
        hint="Add your first piece and Mira will work out what it is."
      />
    </Screen>
  );
}
