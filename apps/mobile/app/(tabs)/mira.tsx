import { Screen, EmptyState } from '@/ui/Screen';

/**
 * Mira — the AI stylist (`docs/02-design/screen-specs.md` §19).
 *
 * MUST NOT look like ChatGPT: no message bubbles, no transcript, no avatar
 * (D-010). The prompt field, vibe chips and swipeable looks arrive in Phase 7.
 */
export default function MiraScreen() {
  return (
    <Screen title="MIRA" subtitle="What are we dressing for?">
      <EmptyState
        message="Mira styles you from what you own."
        hint="Add a few pieces first, then ask for an outfit."
      />
    </Screen>
  );
}
