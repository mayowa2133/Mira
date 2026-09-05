import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import { Icon } from '@/ui/Icon';
import { ClosetGridSkeleton, ClosetState } from '@/features/closet/ClosetGrid';
import { imageSrc, useGarment, useGarmentAttributes } from '@/features/closet/queries';
import { buildChips, buildReviewRows, type ReviewRow } from '@/features/closet/review-rows';

/**
 * AI Item Review (`docs/02-design/screen-specs.md` §12).
 *
 * The rule the layout follows, and the reason it is not a form:
 *
 * > This must look like a fashion product page, not an AI output screen.
 *
 * So the garment's image takes half the screen, the brand and name read as a
 * product title, and what Mira worked out sits underneath as a quiet list. No
 * progress bars, no percentages, no "AI" anywhere in the copy — the user is
 * looking at their dress, not at a model's output.
 *
 * Confidence reaches this screen as bands, never numbers (D-011). A tick means
 * Mira is sure; a plain statement means it thinks so; a question means it is
 * asking; an empty row means it has nothing worth saying and would rather the
 * user filled it in.
 */
export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const garment = useGarment(id);
  const attributes = useGarmentAttributes(id);

  const rows = useMemo(() => buildReviewRows(attributes.data ?? []), [attributes.data]);
  const chips = useMemo(() => buildChips(attributes.data ?? []), [attributes.data]);

  if (garment.isPending) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <ClosetGridSkeleton count={2} />
      </ScrollView>
    );
  }

  if (garment.error || !garment.data) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ClosetState
          message="We couldn't load this piece."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const g = garment.data;
  const image = imageSrc(g.canonical_image, 'medium');
  const brand = g.brand?.name ?? g.brand_raw;
  const subtitle = [g.primary_color, g.size.normalized ?? g.size.raw]
    .filter(Boolean)
    .map((part) => String(part).replace(/_/g, ' '))
    .join(' · ');

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: space.giant * 2 }]}>
        <View style={styles.hero}>
          {image ? (
            <Image
              style={styles.image}
              source={{ uri: image }}
              placeholder={
                g.canonical_image?.blurhash ? { blurhash: g.canonical_image.blurhash } : undefined
              }
              contentFit="cover"
              transition={160}
              accessible={false}
            />
          ) : (
            <View style={styles.placeholder} />
          )}

          <Pressable
            style={[styles.close, { top: insets.top + space.sm }]}
            onPress={() => router.back()}
            hitSlop={space.md}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeGlyph}>×</Text>
          </Pressable>
        </View>

        {brand ? <Text style={styles.brand}>{brand.toUpperCase()}</Text> : null}
        <Text style={styles.title} accessibilityRole="header">
          {g.name ?? 'Your new piece'}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        {chips.length > 0 ? (
          <View style={styles.chipRow}>
            {chips.map((chip) => (
              <Pressable
                key={chip}
                style={styles.chip}
                onPress={() => router.push(`/edit/${g.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${chip}. Double tap to edit.`}
              >
                <Text style={styles.chipLabel}>{chip}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Mira found</Text>
        {attributes.isPending ? (
          <Text style={styles.pending}>Still looking…</Text>
        ) : (
          rows.map((row) => (
            <ReviewFieldRow
              key={row.field}
              row={row}
              onPress={() => router.push(`/edit/${g.id}`)}
            />
          ))
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Pressable
          style={styles.cta}
          onPress={() => router.replace('/closet')}
          accessibilityRole="button"
          accessibilityLabel="Add to my closet"
        >
          <Text style={styles.ctaLabel}>Add to my closet</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * One line of what Mira worked out.
 *
 * Every row is tappable to correct, including the ones Mira is sure about —
 * being sure is not the same as being right, and a row that cannot be corrected
 * makes the user argue with the screen.
 */
function ReviewFieldRow({ row, onPress }: { row: ReviewRow; onPress: () => void }) {
  const empty = row.tone === 'empty';

  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        empty
          ? `${row.label}, not set. Double tap to add.`
          : `${row.label}, ${row.display}${row.showTick ? ', confirmed' : ''}. Double tap to change.`
      }
    >
      <Text style={styles.rowLabel}>{row.label}</Text>
      <Text style={[styles.rowValue, empty && styles.rowValueEmpty]} numberOfLines={1}>
        {empty ? row.placeholder : row.display}
      </Text>
      {/* A tick is the only confidence signal on screen, and it means "sure". */}
      <View style={styles.rowTick}>
        {row.showTick ? <Icon name="check" size={16} color={color.success} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  centered: { justifyContent: 'center' },
  content: { paddingBottom: space.giant },

  hero: { width: '100%', aspectRatio: 0.86, backgroundColor: color.surfaceSunken },
  image: { width: '100%', height: '100%' },
  placeholder: { width: '100%', height: '100%', backgroundColor: color.surfaceSunken },
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
  closeGlyph: { fontSize: 24, lineHeight: 28, color: color.text },

  brand: {
    marginTop: space.xl,
    paddingHorizontal: space.screenX,
    fontSize: type.brand.fontSize,
    letterSpacing: type.brand.letterSpacing,
    fontWeight: type.brand.fontWeight,
    color: color.textSecondary,
  },
  title: {
    marginTop: space.xs,
    paddingHorizontal: space.screenX,
    fontSize: type.title2.fontSize,
    lineHeight: type.title2.lineHeight,
    fontWeight: type.title2.fontWeight,
    color: color.text,
  },
  subtitle: {
    marginTop: space.xs,
    paddingHorizontal: space.screenX,
    fontSize: type.body.fontSize,
    color: color.textSecondary,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingHorizontal: space.screenX,
    marginTop: space.lg,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  chipLabel: { fontSize: type.subhead.fontSize, color: color.text },

  sectionTitle: {
    marginTop: space.xxl,
    marginBottom: space.sm,
    paddingHorizontal: space.screenX,
    fontSize: type.title3.fontSize,
    fontWeight: type.title3.fontWeight,
    color: color.text,
  },
  pending: {
    paddingHorizontal: space.screenX,
    fontSize: type.body.fontSize,
    color: color.textSecondary,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: space.tapMin,
    paddingHorizontal: space.screenX,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  rowLabel: { width: 110, fontSize: type.body.fontSize, color: color.textSecondary },
  rowValue: { flex: 1, fontSize: type.body.fontSize, color: color.text },
  rowValueEmpty: { color: color.textTertiary },
  rowTick: { width: 20, textAlign: 'right', fontSize: type.body.fontSize, color: color.success },

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
