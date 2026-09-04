import { memo, useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { color, layout, radius, space, type } from '@mira/ui';
import { imageSrc, type Garment } from './queries';

/**
 * Garment tile (`docs/02-design/design-system.md` §6, Reference 01).
 *
 *   [ LARGE GARMENT IMAGE ]
 *   ZARA                     <- brand, uppercase, secondary
 *   Satin Midi Dress         <- name, one line
 *   Black · S            ♡   <- colour, size, favourite
 *
 * At most three text lines. Purchase date, SKU, wear count and source belong on
 * the detail screen, never on the tile.
 */
function formatSubtitle(garment: Garment): string {
  return [garment.primary_color, garment.size.normalized ?? garment.size.raw]
    .filter(Boolean)
    .map((part) => String(part).replace(/_/g, ' '))
    .join(' · ');
}

export type GarmentTileProps = {
  garment: Garment;
  onPress: (id: string) => void;
  onToggleFavorite: (id: string, favorite: boolean) => void;
};

function GarmentTileComponent({ garment, onPress, onToggleFavorite }: GarmentTileProps) {
  // Stable callbacks: an inline lambda would re-render every tile in the grid
  // (`docs/08-engineering/coding-standards.md` — React Native).
  const handlePress = useCallback(() => onPress(garment.id), [garment.id, onPress]);
  const handleFavorite = useCallback(
    () => onToggleFavorite(garment.id, !garment.favorite),
    [garment.id, garment.favorite, onToggleFavorite],
  );

  const brand = garment.brand?.name ?? garment.brand_raw;
  const subtitle = formatSubtitle(garment);
  const isAnalyzing = garment.analysis_state === 'analyzing';
  const tileImage = imageSrc(garment.canonical_image, 'thumb');

  // A single accessible label per tile: a screen reader should hear the
  // garment, not four disconnected fragments (docs/02-design/accessibility.md §4).
  const label = [
    brand,
    garment.name,
    subtitle,
    garment.favorite ? 'Favourited' : null,
    isAnalyzing ? 'Still being analyzed' : null,
  ]
    .filter(Boolean)
    .join(', ');

  // The tile is one accessibility element, which means iOS folds the favourite
  // button inside it into the tile and a screen reader can never reach it. The
  // state is audible (the label ends "Favourited") but the CONTROL is not, so
  // favouriting from the grid is impossible with VoiceOver on.
  //
  // A custom action is how iOS exposes a secondary control inside a cell
  // without shattering the cell into fragments — the same mechanism Mail uses
  // for archive/delete on a message row.
  const favoriteActionLabel = garment.favorite ? 'Remove from favourites' : 'Favourite';

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'favorite') handleFavorite();
    },
    [handleFavorite],
  );

  return (
    <Pressable
      style={styles.root}
      onPress={handlePress}
      // A stable identity for UI tests. Identifying a tile by its LABEL was
      // fragile in exactly the way labels are: tab items ("Closet, tab, 2 of 5")
      // and the selected category chip ("All, selected") both matched a
      // comma-based heuristic, so tests silently measured the wrong elements.
      // `testID` maps to accessibilityIdentifier and is invisible to VoiceOver.
      testID="garment-tile"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityActions={[{ name: 'favorite', label: favoriteActionLabel }]}
      onAccessibilityAction={handleAccessibilityAction}
    >
      <View style={styles.imageWrap}>
        {tileImage ? (
          <Image
            style={styles.image}
            // The 400px derivative: a tile is ~169pt wide, so loading the
            // full-size original here was pulling roughly ten times the bytes
            // the screen can use, 228 times over.
            source={{ uri: tileImage }}
            placeholder={
              garment.canonical_image?.blurhash
                ? { blurhash: garment.canonical_image.blurhash }
                : undefined
            }
            contentFit="cover"
            transition={160}
            accessible={false}
          />
        ) : (
          // Never a spinner over an empty box: a sunken placeholder reads as
          // "image coming", which is what it is.
          <View style={styles.placeholder} />
        )}

        <Pressable
          style={styles.favorite}
          onPress={handleFavorite}
          hitSlop={space.md}
          // Reached via the tile's `favorite` custom action, not as a separate
          // element — leaving it accessible here would either be swallowed
          // silently or split the tile into fragments.
          accessible={false}
          importantForAccessibility="no"
        >
          <Text style={[styles.heart, garment.favorite && styles.heartOn]}>
            {garment.favorite ? '♥' : '♡'}
          </Text>
        </Pressable>
      </View>

      {brand ? (
        <Text style={styles.brand} numberOfLines={1}>
          {brand.toUpperCase()}
        </Text>
      ) : null}
      {garment.name ? (
        <Text style={styles.name} numberOfLines={1}>
          {garment.name}
        </Text>
      ) : null}
      {subtitle ? (
        <Text style={styles.meta} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Memoized: the grid re-renders on every page fetch, and re-rendering 40 tiles
 * because one favourite changed is the difference between 60fps and not.
 */
export const GarmentTile = memo(
  GarmentTileComponent,
  (a, b) =>
    a.garment.id === b.garment.id &&
    a.garment.favorite === b.garment.favorite &&
    a.garment.canonical_image?.url === b.garment.canonical_image?.url &&
    a.garment.canonical_image?.thumb_url === b.garment.canonical_image?.thumb_url &&
    a.garment.name === b.garment.name &&
    a.garment.analysis_state === b.garment.analysis_state,
);

const styles = StyleSheet.create({
  root: { flex: 1, marginBottom: space.xxl },
  imageWrap: {
    width: '100%',
    aspectRatio: layout.garmentAspectRatio,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.surfaceSunken,
  },
  image: { width: '100%', height: '100%' },
  placeholder: { width: '100%', height: '100%', backgroundColor: color.surfaceSunken },
  favorite: {
    position: 'absolute',
    right: space.sm,
    bottom: space.sm,
    minWidth: space.tapMin,
    minHeight: space.tapMin,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: space.xs,
  },
  heart: { fontSize: 20, color: color.surface },
  heartOn: { color: color.accent },
  brand: {
    marginTop: space.sm,
    fontSize: type.brand.fontSize,
    lineHeight: type.brand.lineHeight,
    fontWeight: type.brand.fontWeight,
    letterSpacing: type.brand.letterSpacing,
    color: color.textSecondary,
  },
  name: {
    fontSize: type.subhead.fontSize,
    lineHeight: type.subhead.lineHeight,
    color: color.text,
  },
  meta: {
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    color: color.textSecondary,
    textTransform: 'capitalize',
  },
});
