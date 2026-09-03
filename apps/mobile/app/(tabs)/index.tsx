import { Screen, EmptyState } from '@/ui/Screen';

/**
 * Home (`docs/02-design/screen-specs.md` §13).
 *
 * Phase 0 renders the shell and the empty-closet state. The personalized
 * dashboard — today's look, Ask Mira, rediscovery — arrives with the closet and
 * stylist in Phases 1 and 7.
 *
 * FORBIDDEN here, now and later: any counts-first block ("You own 328 items ·
 * 52 Tops"). That is inventory-software thinking.
 */
export default function HomeScreen() {
  return (
    <Screen title="Good evening" subtitle="Wednesday, September 3">
      <EmptyState
        message="Let's find what you already own."
        hint="Scan your clothes, a tag, a receipt, or connect your email — Mira does the rest."
      />
    </Screen>
  );
}
