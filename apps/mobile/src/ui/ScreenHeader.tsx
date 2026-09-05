import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, space, type } from '@mira/ui';

/** Modal-style header with a close affordance and a title. */
export function ScreenHeader({
  title,
  closeLabel = 'Close',
}: {
  title: string;
  closeLabel?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.sm }]}>
      <Pressable
        onPress={() => router.back()}
        style={styles.close}
        hitSlop={space.md}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
      >
        <Text style={styles.closeGlyph}>×</Text>
      </Pressable>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space.screenX, paddingBottom: space.lg, backgroundColor: color.bg },
  close: { width: space.tapMin, height: space.tapMin, justifyContent: 'center' },
  closeGlyph: { fontSize: 28, color: color.text, lineHeight: 30 },
  title: {
    marginTop: space.sm,
    fontSize: type.title1.fontSize,
    lineHeight: type.title1.lineHeight,
    fontWeight: type.title1.fontWeight,
    letterSpacing: type.title1.letterSpacing,
    color: color.text,
  },
});
