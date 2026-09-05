import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { Image } from 'expo-image';
import { color, radius, space, type } from '@mira/ui';
import { compareSlots, type OutfitSlot } from '@mira/taxonomy';
import type { Outfit } from './queries';

/**
 * One look in the masonry (`screen-specs.md` §22).
 *
 * > Cards are non-uniform because they are looks, not standardized products.
 *
 * So the card's height comes from the look itself rather than a fixed ratio: a
 * two-piece look is shorter than a four-piece one. That is what makes the grid
 * read as a mood board instead of a product listing, which is the whole
 * distinction the spec is drawing.
 */
export type LookCardProps = {
  outfit: Outfit;
  onPress: (id: string) => void;
};

/**
 * How each tile divides the collage.
 *
 * Fixed 50%×50% tiles left a two-piece look with an empty bottom half — the
 * card looked broken rather than sparse. The tiles fill the card instead, which
 * is what makes it read as a collage.
 */
function tileSize(count: number): { width: `${number}%`; height: `${number}%` } {
  if (count === 1) return { width: '100%', height: '100%' };
  if (count === 2) return { width: '50%', height: '100%' };
  if (count === 3) return { width: '50%', height: '50%' };
  return { width: '50%', height: '50%' };
}

/** Collage heights, chosen by how much there is to show. */
function aspectFor(pieceCount: number): number {
  if (pieceCount <= 1) return 1;
  if (pieceCount === 2) return 0.82;
  if (pieceCount === 3) return 0.7;
  return 0.62;
}

export function LookCard({ outfit, onPress }: LookCardProps) {
  // Top to bottom, as a look reads — not the order they were added.
  const pieces = [...outfit.items]
    .sort((a, b) => compareSlots(a.slot as OutfitSlot, b.slot as OutfitSlot))
    .filter((item) => item.image_url);

  const label = [
    outfit.name ?? 'Look',
    outfit.occasion ? `for ${outfit.occasion.replace(/_/g, ' ')}` : null,
    `${outfit.items.length} ${outfit.items.length === 1 ? 'piece' : 'pieces'}`,
    outfit.wear.count > 0 ? `worn ${outfit.wear.count} times` : null,
    outfit.favorite ? 'saved' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      style={styles.root}
      testID="look-card"
      onPress={() => onPress(outfit.id)}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.collage, { aspectRatio: aspectFor(pieces.length) }]}>
        {pieces.length === 0 ? (
          <View style={styles.empty} />
        ) : (
          pieces
            .slice(0, 4)
            .map((piece) => (
              <Image
                key={piece.garment_id}
                style={[styles.piece, tileSize(Math.min(pieces.length, 4))]}
                source={{ uri: piece.image_url as string }}
                contentFit="cover"
                transition={140}
                accessible={false}
              />
            ))
        )}
      </View>

      {outfit.name ? (
        <Text style={styles.name} numberOfLines={1}>
          {outfit.name}
        </Text>
      ) : null}

      {/* Wear count only when it is greater than zero: "worn 0 times" is a
          reproach, not information. */}
      {outfit.wear.count > 0 ? (
        <Text style={styles.meta}>
          Worn {outfit.wear.count} {outfit.wear.count === 1 ? 'time' : 'times'}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  collage: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.surfaceSunken,
  },
  piece: { backgroundColor: color.surfaceSunken },
  empty: { flex: 1, backgroundColor: color.surfaceSunken },
  name: {
    marginTop: space.sm,
    fontSize: type.subhead.fontSize,
    color: color.text,
  },
  meta: {
    marginTop: space.xs,
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },
});
