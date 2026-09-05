import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { Image } from 'expo-image';
import { color, radius, space, type } from '@mira/ui';
import { garmentLabel } from '@/features/closet/garment-label';
import type { InsightGarment, SimilarOwnedPair } from './queries';

/**
 * "You might already own this" (`screen-specs.md` §26, task 9.2).
 *
 * ```
 * You might already own this
 * [pair] [pair]
 * ```
 *
 * A pair, not a rail — the whole point is that these two belong together, and
 * showing them as separate tiles in a row would be showing the user four
 * garments and asking them to notice.
 *
 * The reason is given in words, never as a score. Tapping opens either piece;
 * resolving the pair happens on the garment itself, because deciding two things
 * are the same is not something to do from a thumbnail.
 */
export function SimilarOwnedSection({
  pairs,
  onPressGarment,
}: {
  pairs: SimilarOwnedPair[];
  onPressGarment: (id: string) => void;
}) {
  if (pairs.length === 0) return null;

  return (
    <View style={styles.root}>
      <Text style={styles.headline} accessibilityRole="header">
        You might already own this
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {pairs.map((pair) => (
          <View key={`${pair.a.id}-${pair.b.id}`} style={styles.pair} testID="similar-pair">
            <View style={styles.images}>
              <Half garment={pair.a} onPress={onPressGarment} />
              <Half garment={pair.b} onPress={onPressGarment} />
            </View>
            <Text style={styles.summary} numberOfLines={2}>
              {pair.summary}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Half({ garment, onPress }: { garment: InsightGarment; onPress: (id: string) => void }) {
  return (
    <Pressable
      style={styles.half}
      onPress={() => onPress(garment.id)}
      accessibilityRole="button"
      accessibilityLabel={garmentLabel({
        brand: garment.brand,
        name: garment.name,
        subtitle: '',
        category: garment.category,
        favorite: false,
        isAnalyzing: false,
      })}
    >
      {garment.image_url ? (
        <Image
          style={styles.image}
          source={{ uri: garment.image_url }}
          contentFit="cover"
          transition={140}
          accessible={false}
        />
      ) : (
        <View style={styles.image} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: space.xxl },
  headline: {
    paddingHorizontal: space.screenX,
    marginBottom: space.md,
    fontSize: type.title3.fontSize,
    lineHeight: type.title3.lineHeight,
    fontWeight: type.title3.fontWeight,
    color: color.text,
  },
  rail: { paddingHorizontal: space.screenX, gap: space.lg },
  pair: { width: 200 },
  images: { flexDirection: 'row', gap: space.xxs },
  half: { flex: 1 },
  image: {
    width: '100%',
    aspectRatio: 0.78,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceSunken,
  },
  summary: {
    marginTop: space.sm,
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },
});
