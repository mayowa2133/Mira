import { Stack } from 'expo-router';
import { color } from '@mira/ui';

/**
 * Onboarding (`docs/02-design/screen-specs.md` §1–5).
 *
 * A separate root stack, exited rather than popped (`navigation.md` rule 7).
 * Nothing here has a back button into the app, because there is no app to go
 * back to until it finishes.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.bg },
        // Forward motion only. Swiping back into the welcome screen from the
        // account step would let someone leave a half-created account behind.
        gestureEnabled: false,
      }}
    />
  );
}
