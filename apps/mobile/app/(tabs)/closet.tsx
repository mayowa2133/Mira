import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import { ClosetGrid } from '@/features/closet/ClosetGrid';
import { CategoryChips } from '@/features/closet/CategoryChips';
import { FilterSheet } from '@/features/closet/FilterSheet';
import {
  EMPTY_FILTERS,
  appliedChips,
  countActive,
  isEmpty,
  toQueryFilters,
  type FilterState,
} from '@/features/closet/filter-state';
import { useClosetSummary, useGarments, useToggleFavorite } from '@/features/closet/queries';
import { PendingTile } from '@/features/capture/PendingTile';
import {
  discardFailedCapture,
  retryCapture,
  usePendingCaptures,
} from '@/features/capture/queue';

/**
 * Closet (`docs/02-design/screen-specs.md` §14).
 *
 * Two columns, never three (D-009). Applied filters remain VISIBLE as
 * dismissible chips while browsing, so the user can always see and undo what
 * narrowed the grid (Reference 03).
 *
 * The category chips are a fast path over the same filter state as the sheet,
 * so the two can never disagree about what is applied.
 */
export default function ClosetScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const queryFilters = useMemo(() => toQueryFilters(filters), [filters]);

  const summary = useClosetSummary();
  const garments = useGarments(queryFilters);
  const toggleFavorite = useToggleFavorite();

  const items = useMemo(
    () => garments.data?.pages.flatMap((page) => page.data) ?? [],
    [garments.data],
  );

  const chips = useMemo(() => appliedChips(filters), [filters]);

  // Captures still on their way up. They belong at the top of the closet: the
  // user took that photo seconds ago and expects to see it (task 2.6).
  const captures = usePendingCaptures();

  const pending =
    captures.length > 0 ? (
      <View style={styles.pendingRow}>
        {captures.map((entry) => (
          <View key={entry.id} style={styles.pendingCell}>
            <PendingTile
              entry={entry}
              onRetry={retryCapture}
              onDiscard={discardFailedCapture}
            />
          </View>
        ))}
      </View>
    ) : null;

  /** The category chip row reflects a single selected category, if exactly one. */
  const selectedCategory = filters.category.length === 1 ? (filters.category[0] ?? null) : null;

  const handleSelectCategory = useCallback((category: string | null) => {
    setFilters((prev) => ({ ...prev, category: category ? [category] : [] }));
  }, []);

  const handlePressGarment = useCallback((id: string) => router.push(`/garment/${id}`), [router]);

  const handleToggleFavorite = useCallback(
    (id: string, favorite: boolean) => toggleFavorite.mutate({ id, favorite }),
    [toggleFavorite],
  );

  const handleEndReached = useCallback(() => {
    if (garments.hasNextPage && !garments.isFetchingNextPage) void garments.fetchNextPage();
  }, [garments]);

  const handleRefresh = useCallback(() => {
    void garments.refetch();
    void summary.refetch();
  }, [garments, summary]);

  const handleAdd = useCallback(() => router.push('/add'), [router]);
  const handleClearFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const handleApplyFilters = useCallback((next: FilterState) => {
    setFilters(next);
    setSheetOpen(false);
  }, []);

  const activeCount = countActive(filters);
  const total = summary.data?.total;

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title} accessibilityRole="header">
            Closet
          </Text>
          <Text style={styles.subtitle}>
            {total === undefined ? ' ' : `${total} ${total === 1 ? 'piece' : 'pieces'}`}
          </Text>
        </View>
        <Pressable
          onPress={handleAdd}
          style={styles.add}
          accessibilityRole="button"
          accessibilityLabel="Add to your closet"
        >
          <Text style={styles.addLabel}>+ Add</Text>
        </Pressable>
      </View>

      <CategoryChips selected={selectedCategory} onSelect={handleSelectCategory} />

      <View style={styles.controls}>
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={styles.control}
          accessibilityRole="button"
          accessibilityLabel={
            activeCount > 0 ? `Filter, ${activeCount} applied` : 'Filter your closet'
          }
        >
          <Text style={styles.controlLabel}>
            Filter{activeCount > 0 ? ` · ${activeCount}` : ''}
          </Text>
        </Pressable>
      </View>

      {chips.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {chips.map((chip) => (
            <Pressable
              key={chip.key}
              onPress={() => setFilters(chip.remove)}
              style={styles.appliedChip}
              accessibilityRole="button"
              accessibilityLabel={`${chip.label}, applied filter. Double tap to remove.`}
            >
              <Text style={styles.appliedChipLabel}>{chip.label}</Text>
              <Text style={styles.appliedChipRemove}>✕</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ClosetGrid
        garments={items}
        isLoading={garments.isPending}
        error={garments.error}
        hasFilters={!isEmpty(filters)}
        isFetchingNextPage={garments.isFetchingNextPage}
        onEndReached={handleEndReached}
        onRefresh={handleRefresh}
        isRefreshing={garments.isRefetching && !garments.isFetchingNextPage}
        onPressGarment={handlePressGarment}
        onToggleFavorite={handleToggleFavorite}
        onClearFilters={handleClearFilters}
        onAddFirst={handleAdd}
        header={header}
        pending={pending}
      />

      <FilterSheet
        visible={sheetOpen}
        initial={filters}
        onClose={() => setSheetOpen(false)}
        onApply={handleApplyFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  header: { paddingTop: space.lg, paddingBottom: space.sm },
  // Matches the grid's two columns, so a pending capture sits exactly where
  // the finished garment will appear.
  pendingRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.xs },
  pendingCell: { width: '50%', paddingHorizontal: space.xs, paddingBottom: space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: {
    fontSize: type.title1.fontSize,
    lineHeight: type.title1.lineHeight,
    fontWeight: type.title1.fontWeight,
    letterSpacing: type.title1.letterSpacing,
    color: color.text,
  },
  subtitle: {
    marginTop: space.xxs,
    fontSize: type.subhead.fontSize,
    lineHeight: type.subhead.lineHeight,
    color: color.textSecondary,
  },
  add: { minHeight: space.tapMin, justifyContent: 'center', paddingHorizontal: space.sm },
  addLabel: {
    fontSize: type.bodyStrong.fontSize,
    fontWeight: type.bodyStrong.fontWeight,
    color: color.text,
  },

  controls: { flexDirection: 'row', paddingTop: space.sm },
  control: { minHeight: space.tapMin, justifyContent: 'center', paddingRight: space.lg },
  controlLabel: {
    fontSize: type.subhead.fontSize,
    fontWeight: type.bodyStrong.fontWeight,
    color: color.text,
  },

  chipRow: { gap: space.sm, paddingBottom: space.sm },
  appliedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    backgroundColor: color.accentSoft,
  },
  appliedChipLabel: { fontSize: type.subhead.fontSize, color: color.text },
  appliedChipRemove: { fontSize: type.caption.fontSize, color: color.textSecondary },
});
