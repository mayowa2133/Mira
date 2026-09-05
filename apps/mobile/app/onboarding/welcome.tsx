import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, space, type } from '@mira/ui';

/**
 * Welcome (§2).
 *
 * The spec calls for full-screen lifestyle photography with a bottom gradient
 * scrim, referencing Aritzia editorial. There is no photography in the
 * repository and none may be scraped from a retailer, so this ships the
 * typographic half honestly — wordmark, headline, two actions on the ivory
 * ground — rather than a grey rectangle standing in for an image.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.giant }]}>
      <Text style={styles.wordmark} accessibilityRole="header">
        MIRA
      </Text>

      <View style={styles.middle}>
        <Text style={styles.headline}>Your closet. Your stylist. Your mirror.</Text>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + space.xl }]}>
        <Pressable
          style={styles.primary}
          onPress={() => router.push('/onboarding/value')}
          accessibilityRole="button"
          testID="onboarding-get-started"
        >
          <Text style={styles.primaryLabel}>Get started</Text>
        </Pressable>

        <Pressable
          style={styles.tertiary}
          onPress={() => router.push('/onboarding/account')}
          accessibilityRole="button"
        >
          <Text style={styles.tertiaryLabel}>I already have an account</Text>
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
  middle: { flex: 1, justifyContent: 'center' },
  headline: {
    fontSize: type.display.fontSize,
    lineHeight: type.display.lineHeight,
    fontWeight: type.display.fontWeight,
    letterSpacing: type.display.letterSpacing,
    color: color.text,
  },
  actions: { gap: space.sm },
  primary: {
    minHeight: space.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: color.text,
  },
  primaryLabel: { fontSize: type.body.fontSize, color: color.inverseText },
  tertiary: { minHeight: space.tapMin, alignItems: 'center', justifyContent: 'center' },
  tertiaryLabel: { fontSize: type.subhead.fontSize, color: color.textSecondary },
});
