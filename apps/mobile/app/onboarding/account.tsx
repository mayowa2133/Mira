import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, space, type } from '@mira/ui';
import {
  SIGN_IN_METHODS,
  createUnavailableSignIn,
  describeSignInFailure,
  type SignInMethod,
} from '@/features/onboarding/sign-in';

/**
 * Create account (§4).
 *
 * Ivory ground, wordmark, three stacked options, legal copy in caption. No
 * decoration — the spec is emphatic about that.
 *
 * The provider SDKs are the unbuilt half of task 0.5, so each option currently
 * fails with an inline message. Inline is the spec's requirement, and it is
 * also the honest shape: a system alert would read as something going wrong,
 * when in fact nothing is connected yet.
 */
export default function CreateAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [client] = useState(createUnavailableSignIn);
  const [failed, setFailed] = useState<{ method: SignInMethod; message: string } | null>(null);

  const attempt = useCallback(
    (method: SignInMethod) => {
      setFailed(null);
      client
        .start(method)
        .then(() => router.replace('/onboarding/closet'))
        .catch((error: unknown) => setFailed({ method, message: describeSignInFailure(error) }));
    },
    [client, router],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.giant }]}>
      <Text style={styles.wordmark} accessibilityRole="header">
        MIRA
      </Text>

      <View style={styles.options}>
        {SIGN_IN_METHODS.map((method) => (
          <View key={method.key}>
            <Pressable
              style={styles.option}
              onPress={() => attempt(method.key)}
              accessibilityRole="button"
              testID={`sign-in-${method.key}`}
            >
              <Text style={styles.optionLabel}>{method.label}</Text>
            </Pressable>

            {/* Beneath the tapped option, never a system alert (§4). */}
            {failed?.method === method.key ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {failed.message}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.xl }]}>
        <Text style={styles.legal}>
          By continuing you agree to Mira&apos;s Terms and Privacy Policy.
        </Text>

        {/* Until sign-in exists, the flow must still have a way through, or
            onboarding is a wall. This is the same tertiary treatment §5 gives
            "I'll do this later" — never styled as failure. */}
        <Pressable
          style={styles.tertiary}
          onPress={() => router.replace('/onboarding/closet')}
          accessibilityRole="button"
          testID="sign-in-later"
        >
          <Text style={styles.tertiaryLabel}>Look around first</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg, paddingHorizontal: space.screenX },
  wordmark: {
    textAlign: 'center',
    fontSize: type.wordmark.fontSize,
    letterSpacing: type.wordmark.letterSpacing,
    fontWeight: type.wordmark.fontWeight,
    color: color.text,
  },
  options: { flex: 1, justifyContent: 'center', gap: space.sm },
  option: {
    minHeight: space.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: color.text,
  },
  optionLabel: { fontSize: type.body.fontSize, color: color.text },
  error: {
    marginTop: space.xs,
    paddingHorizontal: space.md,
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },
  footer: { gap: space.md },
  legal: { textAlign: 'center', fontSize: type.caption.fontSize, color: color.textTertiary },
  tertiary: { minHeight: space.tapMin, alignItems: 'center', justifyContent: 'center' },
  tertiaryLabel: { fontSize: type.subhead.fontSize, color: color.textSecondary },
});
