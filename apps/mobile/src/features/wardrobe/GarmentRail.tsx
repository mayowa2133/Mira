import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { color, radius, space, type } from '@mira/ui';
import { garmentLabel } from '@/features/closet/garment-label';

/**
 * A horizontal row of garments under a headline.
 *
 * The shape both Home and the insights screen use, because §13 and §26 describe
 * the same thing: a sentence, then imagery, then a way to see the rest.
 *
 * Numbers stay secondary to imagery (§26). The headline may contain a count
 * because it is a sentence — "17 pieces deserve another chance" — but nothing
 * here renders a metric on its own.
 */
export type RailGarment = {
  id: string;
  name: string | null;
  brand: string | null;
  category: string;
  image_url: string | null;
};

export type GarmentRailProps = {
  headline: string;
  /** Optional line under the headline, in the product's voice. */
  caption?: string;
  garments: RailGarment[];
  /** Total available, when the rail is a preview of more. */
  total?: number;
  onPressGarment: (id: string) => void;
  onSeeAll?: () => void;
};

export function GarmentRail({
  headline,
  caption,
  garments,
  total,
  onPressGarment,
  onSeeAll,
}: GarmentRailProps) {
  if (garments.length === 0) return null;

  const hasMore = typeof total === 'number' && total > garments.length;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headline} accessibilityRole="header">
            {headline}
          </Text>
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        </View>

        {onSeeAll && hasMore ? (
          <Pressable
            onPress={onSeeAll}
            hitSlop={space.sm}
            accessibilityRole="button"
            accessibilityLabel={`See all ${total} — ${headline}`}
          >
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {garments.map((garment) => (
          <Pressable
            key={garment.id}
            style={styles.cell}
            testID="rail-garment"
            onPress={() => onPressGarment(garment.id)}
            accessibilityRole="button"
            // The same phrasing as a closet tile: a listener should hear the
            // garment, not a position in a carousel.
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
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: space.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space.screenX,
    marginBottom: space.md,
  },
  headerText: { flex: 1, paddingRight: space.md },
  headline: {
    fontSize: type.title3.fontSize,
    lineHeight: type.title3.lineHeight,
    fontWeight: type.title3.fontWeight,
    color: color.text,
  },
  caption: { marginTop: space.xs, fontSize: type.subhead.fontSize, color: color.textSecondary },
  seeAll: { fontSize: type.subhead.fontSize, color: color.textSecondary },

  rail: { paddingHorizontal: space.screenX, gap: space.md },
  cell: { width: 132 },
  image: {
    width: 132,
    aspectRatio: 0.78,
    borderRadius: radius.md,
    backgroundColor: color.surfaceSunken,
  },
});
