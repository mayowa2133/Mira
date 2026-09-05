import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import { Icon } from '@/ui/Icon';
import { compareSlots, type OutfitSlot } from '@mira/taxonomy';
import { ClosetGridSkeleton, ClosetState } from '@/features/closet/ClosetGrid';
import { useSnackbar } from '@/ui/Snackbar';
import {
  useDeleteOutfit,
  useOutfit,
  useRecordWear,
  useToggleOutfitFavorite,
} from '@/features/outfits/queries';

/**
 * Look detail (`docs/02-design/screen-specs.md` §21).
 *
 * Large look image, occasion title, then every constituent garment as a
 * tappable row with thumbnail, brand and name.
 *
 * `Try it on` is Phase 10 and is deliberately absent rather than present and
 * inert — a button that does nothing teaches the user not to trust buttons.
 */
export default function LookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useSnackbar();

  const outfit = useOutfit(id);
  const wear = useRecordWear();
  const favorite = useToggleOutfitFavorite();
  const remove = useDeleteOutfit();

  const markWorn = useCallback(() => {
    wear.mutate(
      { outfit_id: id },
      {
        onSuccess: (result) => {
          // Says what actually happened: wearing a look wears everything in it,
          // and the closet's counts have just changed.
          const pieces = Math.max(0, result.created - 1);
          show({ message: `Worn today — ${pieces} ${pieces === 1 ? 'piece' : 'pieces'} updated.` });
        },
        onError: () => show({ message: "We couldn't record that.", tone: 'error' }),
      },
    );
  }, [id, show, wear]);

  const confirmDelete = useCallback(() => {
    Alert.alert('Delete this look?', 'Your pieces stay in your closet.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(id, {
            onSuccess: () => {
              show({ message: 'Look deleted.' });
              router.back();
            },
          }),
      },
    ]);
  }, [id, remove, router, show]);

  if (outfit.isPending) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <ClosetGridSkeleton count={2} />
      </ScrollView>
    );
  }

  if (outfit.error || !outfit.data) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ClosetState
          message="This look isn't saved any more."
          actionLabel="Back to looks"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const look = outfit.data;
  const pieces = [...look.items].sort((a, b) =>
    compareSlots(a.slot as OutfitSlot, b.slot as OutfitSlot),
  );
  const withImages = pieces.filter((piece) => piece.image_url);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: space.giant * 2 }]}>
        <View style={styles.hero}>
          {withImages.length === 0 ? (
            <View style={styles.heroEmpty} />
          ) : (
            withImages
              .slice(0, 4)
              .map((piece) => (
                <Image
                  key={piece.garment_id}
                  style={[styles.heroPiece, withImages.length === 1 && styles.heroSingle]}
                  source={{ uri: piece.image_url as string }}
                  contentFit="cover"
                  transition={160}
                  accessible={false}
                />
              ))
          )}

          <Pressable
            style={[styles.close, { top: insets.top + space.sm }]}
            onPress={() => router.back()}
            hitSlop={space.md}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Icon name="chevronLeft" size={24} color={color.text} />
          </Pressable>
        </View>

        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text style={styles.title} accessibilityRole="header">
              {look.name ?? 'Your look'}
            </Text>
            {look.occasion ? (
              <Text style={styles.subtitle}>For {look.occasion.replace(/_/g, ' ')}</Text>
            ) : null}
            {look.wear.count > 0 ? (
              <Text style={styles.subtitle}>
                Worn {look.wear.count} {look.wear.count === 1 ? 'time' : 'times'}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => favorite.mutate({ id, favorite: !look.favorite })}
            style={styles.heart}
            hitSlop={space.sm}
            accessibilityRole="switch"
            accessibilityState={{ checked: look.favorite }}
            accessibilityLabel={look.favorite ? 'Remove from saved' : 'Save this look'}
          >
            <Icon
              name="heart"
              size={24}
              filled={look.favorite}
              color={look.favorite ? color.accent : color.text}
            />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>In this look</Text>
        {pieces.map((piece) => (
          <Pressable
            key={piece.garment_id}
            style={styles.pieceRow}
            onPress={() => router.push(`/garment/${piece.garment_id}`)}
            accessibilityRole="button"
            accessibilityLabel={[piece.brand, piece.name, piece.slot].filter(Boolean).join(', ')}
          >
            {piece.image_url ? (
              <Image
                style={styles.thumb}
                source={{ uri: piece.image_url }}
                contentFit="cover"
                accessible={false}
              />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]} />
            )}

            <View style={styles.pieceText}>
              {piece.brand ? (
                <Text style={styles.pieceBrand}>{piece.brand.toUpperCase()}</Text>
              ) : null}
              <Text style={styles.pieceName} numberOfLines={1}>
                {piece.name ?? piece.category ?? 'Piece'}
              </Text>
            </View>

            <Text style={styles.pieceSlot}>{piece.slot.replace(/_/g, ' ')}</Text>
          </Pressable>
        ))}

        <Pressable
          style={styles.destructive}
          onPress={confirmDelete}
          accessibilityRole="button"
          accessibilityLabel="Delete this look"
        >
          <Text style={styles.destructiveLabel}>Delete look</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Pressable
          style={styles.cta}
          onPress={markWorn}
          disabled={wear.isPending}
          accessibilityRole="button"
          accessibilityLabel="Wear this today"
          accessibilityState={{ disabled: wear.isPending }}
        >
          <Text style={styles.ctaLabel}>{wear.isPending ? 'Saving…' : 'Wear this'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  centered: { justifyContent: 'center' },
  content: { paddingBottom: space.giant },

  hero: {
    width: '100%',
    aspectRatio: 0.9,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: color.surfaceSunken,
  },
  heroPiece: { width: '50%', height: '50%' },
  heroSingle: { width: '100%', height: '100%' },
  heroEmpty: { flex: 1 },
  close: {
    position: 'absolute',
    left: space.lg,
    width: space.tapMin,
    height: space.tapMin,
    borderRadius: radius.full,
    backgroundColor: color.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: 28, lineHeight: 32, color: color.text },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: space.screenX,
    paddingTop: space.xl,
  },
  titleText: { flex: 1 },
  title: {
    fontSize: type.title2.fontSize,
    lineHeight: type.title2.lineHeight,
    fontWeight: type.title2.fontWeight,
    color: color.text,
  },
  subtitle: { marginTop: space.xs, fontSize: type.body.fontSize, color: color.textSecondary },
  heart: { minWidth: space.tapMin, minHeight: space.tapMin, alignItems: 'flex-end' },
  heartGlyph: { fontSize: 24, color: color.textTertiary },
  heartOn: { color: color.accent },

  sectionTitle: {
    marginTop: space.xxl,
    marginBottom: space.sm,
    paddingHorizontal: space.screenX,
    fontSize: type.title3.fontSize,
    fontWeight: type.title3.fontWeight,
    color: color.text,
  },

  pieceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.screenX,
    paddingVertical: space.sm,
    minHeight: space.tapMin,
  },
  thumb: { width: 52, height: 66, borderRadius: radius.sm, backgroundColor: color.surfaceSunken },
  thumbEmpty: { backgroundColor: color.surfaceSunken },
  pieceText: { flex: 1, marginLeft: space.md },
  pieceBrand: {
    fontSize: type.brand.fontSize,
    letterSpacing: type.brand.letterSpacing,
    color: color.textSecondary,
  },
  pieceName: { marginTop: space.xs, fontSize: type.body.fontSize, color: color.text },
  pieceSlot: { fontSize: type.caption.fontSize, color: color.textTertiary },

  destructive: { marginTop: space.xxl, paddingHorizontal: space.screenX, minHeight: space.tapMin },
  destructiveLabel: { fontSize: type.body.fontSize, color: color.danger },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: space.md,
    paddingHorizontal: space.screenX,
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.divider,
  },
  cta: {
    minHeight: space.tapMin,
    borderRadius: radius.full,
    backgroundColor: color.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { fontSize: type.body.fontSize, color: color.inverseText },
});
