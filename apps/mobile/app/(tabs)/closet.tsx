import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, space, type } from '@mira/ui';
import { ClosetGrid } from '@/features/closet/ClosetGrid';
import { CategoryChips } from '@/features/closet/CategoryChips';
import {
  useClosetSummary,
  useGarments,
  useToggleFavorite,
  type ClosetFilters,
} from '@/features/closet/queries';

/**
 * Closet (`docs/02-design/screen-specs.md` §14).
 *
 *   Closet                          + Add
 *   327 pieces
 *   [ Search your closet ]
 *   All  Tops  Bottoms  Dresses  Shoes →
 *   Filter                          Sort
 *   [two-column grid]
 *
 * Two columns, never three (D-009). Search and the filter sheet arrive with
 * Phase 5 and the rest of 1.8.
 */
export default function ClosetScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<string | null>(null);

  const filters: ClosetFilters = useMemo(
    () => (category ? { category: [category] } : {}),
    [category],
  );

  const summary = useClosetSummary();
  const garments = useGarments(filters);
  const toggleFavorite = useToggleFavorite();

  const items = useMemo(
    () => garments.data?.pages.flatMap((page) => page.data) ?? [],
    [garments.data],
  );

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

      <CategoryChips selected={category} onSelect={setCategory} />
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ClosetGrid
        garments={items}
        isLoading={garments.isPending}
        error={garments.error}
        hasFilters={category !== null}
        isFetchingNextPage={garments.isFetchingNextPage}
        onEndReached={handleEndReached}
        onRefresh={handleRefresh}
        isRefreshing={garments.isRefetching && !garments.isFetchingNextPage}
        onPressGarment={handlePressGarment}
        onToggleFavorite={handleToggleFavorite}
        onClearFilters={() => setCategory(null)}
        onAddFirst={handleAdd}
        header={header}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  header: { paddingTop: space.lg, paddingBottom: space.sm },
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
  add: {
    minHeight: space.tapMin,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  addLabel: {
    fontSize: type.bodyStrong.fontSize,
    fontWeight: type.bodyStrong.fontWeight,
    color: color.text,
  },
});
