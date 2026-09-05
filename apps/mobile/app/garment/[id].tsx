import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '@/ui/Text';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import { Icon } from '@/ui/Icon';
import { ApiError } from '@/lib/api';
import { ClosetGridSkeleton, ClosetState } from '@/features/closet/ClosetGrid';
import {
  useGarment,
  useRemoveGarment,
  useRestoreGarment,
  useSetStatus,
  useToggleFavorite,
  imageSrc,
} from '@/features/closet/queries';
import { useSnackbar } from '@/ui/Snackbar';
import {
  UNDO_DURATION_MS,
  leavesTheCloset,
  removalConfirmation,
  statusChangeMessage,
  undoForRemoval,
} from '@/features/closet/undo';

/**
 * Garment detail (`docs/02-design/screen-specs.md` §17, Reference 02 — SSENSE).
 *
 * Editorial treatment: a large hero image, restrained typography, and secondary
 * information below. This screen should make a piece the user owns feel as
 * important as a product on a luxury-fashion store — "this is one of your
 * pieces", not "this is row #482 in your inventory".
 */
function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const titleCase = (v: string | null) => (v ? v.replace(/_/g, ' ') : null);

export default function GarmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const garment = useGarment(id ?? '');
  const toggleFavorite = useToggleFavorite();
  const setStatus = useSetStatus();
  const removeGarment = useRemoveGarment();
  const restoreGarment = useRestoreGarment();
  const snackbar = useSnackbar();

  const handleFavorite = useCallback(() => {
    if (garment.data)
      toggleFavorite.mutate({ id: garment.data.id, favorite: !garment.data.favorite });
  }, [garment.data, toggleFavorite]);

  /**
   * Change status, then offer Undo.
   *
   * Reversible changes happen immediately and offer a way back, rather than
   * interrupting with a dialog first (`docs/02-design/states-and-errors.md`).
   */
  const changeStatus = useCallback(
    (next: string) => {
      const current = garment.data;
      if (!current) return;
      const previous = current.status;

      setStatus.mutate(
        { id: current.id, status: next },
        {
          onSuccess: () => {
            snackbar.show({
              message: statusChangeMessage(next as never),
              actionLabel: 'Undo',
              durationMs: UNDO_DURATION_MS,
              onAction: () => setStatus.mutate({ id: current.id, status: previous }),
            });
            // Archiving takes the piece out of the closet, so staying on a
            // detail screen the grid no longer lists would be disorienting.
            if (leavesTheCloset(next as never)) router.back();
          },
          onError: (error) => {
            snackbar.show({
              message: error instanceof ApiError ? error.message : "That didn't save.",
              tone: 'error',
            });
          },
        },
      );
    },
    [garment.data, router, setStatus, snackbar],
  );

  const handleLaundry = useCallback(() => {
    if (!garment.data) return;
    // A garment in the laundry is excluded from generated outfits (INV-2, D-012).
    changeStatus(garment.data.status === 'laundry' ? 'active' : 'laundry');
  }, [changeStatus, garment.data]);

  const handleArchive = useCallback(() => {
    if (!garment.data) return;
    changeStatus(garment.data.status === 'archived' ? 'active' : 'archived');
  }, [changeStatus, garment.data]);

  /**
   * Remove, with a confirmation.
   *
   * Removal is the one closet action that CONFIRMS rather than simply offering
   * undo, because it reads as deletion. The confirmation states exactly what
   * happens and that it is recoverable, which the API guarantees for 30 days.
   */
  const handleRemove = useCallback(() => {
    const current = garment.data;
    if (!current) return;
    const copy = removalConfirmation(current.name);

    Alert.alert(copy.title, copy.body, [
      { text: copy.cancelLabel, style: 'cancel' },
      {
        text: copy.confirmLabel,
        style: 'destructive',
        onPress: () => {
          removeGarment.mutate(current.id, {
            onSuccess: () => {
              const undo = undoForRemoval();
              router.back();
              snackbar.show({
                message: undo.message,
                actionLabel: undo.actionLabel,
                durationMs: UNDO_DURATION_MS,
                onAction: () => restoreGarment.mutate(current.id),
              });
            },
            onError: (error) => {
              snackbar.show({
                message: error instanceof ApiError ? error.message : "We couldn't remove that.",
                tone: 'error',
              });
            },
          });
        },
      },
    ]);
  }, [garment.data, removeGarment, restoreGarment, router, snackbar]);

  const handleOverflow = useCallback(() => {
    const current = garment.data;
    if (!current) return;

    // Edit is already a visible action below, so it is not repeated here.
    Alert.alert(current.name ?? 'This piece', undefined, [
      {
        text: current.status === 'archived' ? 'Unarchive' : 'Archive',
        onPress: handleArchive,
      },
      { text: 'Remove', style: 'destructive', onPress: handleRemove },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [garment.data, handleArchive, handleRemove]);

  if (garment.isPending) {
    return (
      <ScrollView
        style={[styles.root, { paddingTop: insets.top }]}
        contentContainerStyle={styles.pad}
      >
        <ClosetGridSkeleton count={2} />
      </ScrollView>
    );
  }

  if (garment.error || !garment.data) {
    const apiError = garment.error instanceof ApiError ? garment.error : null;
    const gone = apiError?.status === 404;
    return (
      <ScrollView
        style={[styles.root, { paddingTop: insets.top }]}
        contentContainerStyle={styles.pad}
      >
        <ClosetState
          message={
            gone ? "This piece isn't in your closet any more." : "We couldn't load this piece."
          }
          hint={gone ? undefined : (apiError?.message ?? undefined)}
          actionLabel={gone ? 'Back to closet' : 'Try again'}
          onAction={gone ? () => router.back() : () => void garment.refetch()}
        />
      </ScrollView>
    );
  }

  const g = garment.data;
  const detailImage = imageSrc(g.canonical_image, 'medium');
  const brand = g.brand?.name ?? g.brand_raw;
  const subtitle = [titleCase(g.primary_color), g.size.normalized ?? g.size.raw]
    .filter(Boolean)
    .join(' · ');

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: space.giant }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { height: width * 1.15 }]}>
        {detailImage ? (
          <Image
            style={styles.heroImage}
            // 1080px is the detail budget; the original is kept for
            // re-analysis and try-on, not for display.
            source={{ uri: detailImage }}
            placeholder={
              g.canonical_image?.blurhash ? { blurhash: g.canonical_image.blurhash } : undefined
            }
            contentFit="cover"
            transition={200}
            accessibilityLabel={[brand, g.name, subtitle].filter(Boolean).join(', ')}
          />
        ) : (
          <View style={styles.heroPlaceholder} />
        )}

        <Pressable
          onPress={() => router.back()}
          style={[styles.back, { top: insets.top + space.sm }]}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={space.md}
        >
          <Text style={styles.backGlyph}>←</Text>
        </Pressable>

        <Pressable
          onPress={handleOverflow}
          style={[styles.overflow, { top: insets.top + space.sm }]}
          accessibilityRole="button"
          accessibilityLabel="More actions"
          hitSlop={space.md}
        >
          <Text style={styles.backGlyph}>⋯</Text>
        </Pressable>
      </View>

      <View style={styles.pad}>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            {brand ? <Text style={styles.brand}>{brand.toUpperCase()}</Text> : null}
            {g.name ? <Text style={styles.name}>{g.name}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <Pressable
            onPress={handleFavorite}
            style={styles.favorite}
            accessibilityRole="switch"
            accessibilityState={{ checked: g.favorite }}
            accessibilityLabel={g.favorite ? 'Remove from favourites' : 'Favourite'}
            hitSlop={space.sm}
          >
            <Icon
              name="heart"
              size={24}
              filled={g.favorite}
              color={g.favorite ? color.accent : color.text}
            />
          </Pressable>
        </View>

        {/* Style it and Try it on arrive in Phases 7 and 10. Showing them now
            would promise something Mira cannot do yet. */}
        <View style={styles.actions}>
          <Pressable
            style={styles.secondaryButton}
            onPress={handleLaundry}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryLabel}>
              {g.status === 'laundry' ? 'Back in the closet' : 'In the laundry'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push(`/edit/${g.id}`)}
            accessibilityRole="button"
            accessibilityLabel="Edit this piece"
          >
            <Text style={styles.secondaryLabel}>Edit</Text>
          </Pressable>
        </View>

        {g.status !== 'active' ? (
          <Text style={styles.statusNote}>
            {/* Status carries a label, never colour alone (A11Y-4). */}
            {g.status === 'laundry'
              ? "In the laundry — Mira won't suggest this until it's back."
              : `Status: ${titleCase(g.status)}`}
          </Text>
        ) : null}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Details</Text>
        <Row label="Category" value={titleCase(g.subcategory ?? g.category)} />
        <Row label="Colour" value={titleCase(g.primary_color)} />
        <Row label="Pattern" value={titleCase(g.pattern)} />
        <Row label="Material" value={g.materials.map((m) => titleCase(m)).join(', ') || null} />
        <Row label="Size" value={g.size.raw} />
        <Row label="Season" value={g.season.map((s) => titleCase(s)).join(', ') || null} />
        <Row label="Occasion" value={g.occasion.map((o) => titleCase(o)).join(', ') || null} />

        <Text style={styles.sectionTitle}>Purchase</Text>
        <Row label="Retailer" value={g.purchase.retailer} />
        <Row label="Date" value={g.purchase.date} />
        <Row
          label="Price"
          value={
            g.purchase.price
              ? `${g.purchase.price.amount.toFixed(2)} ${g.purchase.price.currency}`
              : null
          }
        />
        {/* Provenance is never discarded (CAP-3), so it is always shown. */}
        <Row label="Added by" value={titleCase(g.source.type)} />

        <Text style={styles.sectionTitle}>Wear</Text>
        <Row label="Worn" value={g.wear.count === 0 ? 'Never worn' : `${g.wear.count} times`} />
        <Row
          label="Last worn"
          value={g.wear.last_worn_at ? g.wear.last_worn_at.slice(0, 10) : null}
        />
        <Row
          label="Cost per wear"
          value={
            g.wear.cost_per_wear
              ? `${g.wear.cost_per_wear.amount.toFixed(2)} ${g.wear.cost_per_wear.currency}`
              : null
          }
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  pad: { paddingHorizontal: space.screenX },
  hero: { width: '100%', backgroundColor: color.surfaceSunken },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { width: '100%', height: '100%', backgroundColor: color.surfaceSunken },
  back: {
    position: 'absolute',
    left: space.lg,
    width: space.tapMin,
    height: space.tapMin,
    borderRadius: radius.full,
    backgroundColor: color.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: { fontSize: 20, color: color.text },
  overflow: {
    position: 'absolute',
    right: space.lg,
    width: space.tapMin,
    height: space.tapMin,
    borderRadius: radius.full,
    backgroundColor: color.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: space.xxl },
  titleText: { flex: 1, paddingRight: space.lg },
  brand: {
    fontSize: type.brand.fontSize,
    lineHeight: type.brand.lineHeight,
    fontWeight: type.brand.fontWeight,
    letterSpacing: type.brand.letterSpacing,
    color: color.textSecondary,
  },
  name: {
    marginTop: space.xs,
    fontSize: type.title2.fontSize,
    lineHeight: type.title2.lineHeight,
    fontWeight: type.title2.fontWeight,
    color: color.text,
  },
  subtitle: {
    marginTop: space.xs,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: color.textSecondary,
    textTransform: 'capitalize',
  },
  favorite: { minWidth: space.tapMin, minHeight: space.tapMin, alignItems: 'flex-end' },
  heart: { fontSize: 24, color: color.textSecondary },
  heartOn: { color: color.accent },

  actions: { flexDirection: 'row', gap: space.md, marginTop: space.xxl },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: type.bodyStrong.fontSize,
    fontWeight: type.bodyStrong.fontWeight,
    color: color.text,
  },
  statusNote: {
    marginTop: space.md,
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    color: color.textSecondary,
  },

  divider: { height: 1, backgroundColor: color.divider, marginVertical: space.xxxl },
  sectionTitle: {
    marginTop: space.xxl,
    marginBottom: space.md,
    fontSize: type.title3.fontSize,
    lineHeight: type.title3.lineHeight,
    fontWeight: type.title3.fontWeight,
    color: color.text,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  rowLabel: {
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: color.textSecondary,
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: color.text,
    textTransform: 'capitalize',
  },
});
