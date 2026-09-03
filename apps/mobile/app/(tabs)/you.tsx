import { Screen, EmptyState } from '@/ui/Screen';

/**
 * You (`docs/02-design/screen-specs.md` §28).
 *
 * Style preferences, body profile, connected accounts, and Privacy & data —
 * which must expose deletion of body images, try-ons and the account in one
 * place (`docs/07-security/data-retention.md`).
 */
export default function YouScreen() {
  return (
    <Screen title="You">
      <EmptyState
        message="Sign in to sync your closet."
        hint="Your closet, body photos and try-ons are private by default."
      />
    </Screen>
  );
}
