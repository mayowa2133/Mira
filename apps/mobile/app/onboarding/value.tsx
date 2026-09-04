import { useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, space, type } from '@mira/ui';
import { VALUE_CARDS } from '@/features/onboarding/state';

/**
 * Value proposition (§3).
 *
 * Three swipeable full-bleed cards with page dots, `Continue` on the last and
 * `Skip` top-right. The three lines are the spec's, verbatim.
 */
export default function ValuePropositionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const width = Dimensions.get('window').width;
  const [page, setPage] = useState(0);
  const scroller = useRef<ScrollView>(null);

  const isLast = page === VALUE_CARDS.length - 1;

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  const advance = () => {
    if (isLast) {
      router.push('/onboarding/account');
      return;
    }
    scroller.current?.scrollTo({ x: (page + 1) * width, animated: true });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Pressable
          onPress={() => router.push('/onboarding/account')}
          hitSlop={space.md}
          accessibilityRole="button"
          testID="onboarding-skip"
        >
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {VALUE_CARDS.map((card) => (
          <View key={card.title} style={[styles.card, { width }]}>
            <Text style={styles.cardTitle} accessibilityRole="header">
              {card.title}
            </Text>
            <Text style={styles.cardBody}>{card.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`Page ${page + 1} of ${VALUE_CARDS.length}`}
      >
        {VALUE_CARDS.map((card, index) => (
          <View
            key={card.title}
            style={[styles.dot, index === page && styles.dotActive]}
            accessible={false}
          />
        ))}
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + space.xl }]}>
        <Pressable
          style={styles.primary}
          onPress={advance}
          accessibilityRole="button"
          testID="onboarding-continue"
        >
          <Text style={styles.primaryLabel}>{isLast ? 'Continue' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  top: { alignItems: 'flex-end', paddingHorizontal: space.screenX, minHeight: space.tapMin },
  skip: { fontSize: type.subhead.fontSize, color: color.textSecondary },
  pager: { flex: 1 },
  card: { justifyContent: 'center', paddingHorizontal: space.screenX },
  cardTitle: {
    fontSize: type.display.fontSize,
    lineHeight: type.display.lineHeight,
    fontWeight: type.display.fontWeight,
    letterSpacing: type.display.letterSpacing,
    color: color.text,
  },
  cardBody: {
    marginTop: space.md,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: color.textSecondary,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.xs, marginBottom: space.xl },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.divider },
  dotActive: { backgroundColor: color.text },
  actions: { paddingHorizontal: space.screenX },
  primary: {
    minHeight: space.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: color.text,
  },
  primaryLabel: { fontSize: type.body.fontSize, color: color.inverseText },
});
