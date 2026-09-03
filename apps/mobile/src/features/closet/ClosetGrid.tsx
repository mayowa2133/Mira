import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { color, layout, radius, space, type } from '@mira/ui';
import { ApiError } from '@/lib/api';
import { GarmentTile } from './GarmentTile';
import type { Garment } from './queries';

/**
 * Closet grid (`docs/02-design/screen-specs.md` §14, Reference 01).
 *
 * TWO columns, never three: image size beats density (D-009).
 *
 * Implements every state required by `docs/02-design/states-and-errors.md`:
 * loading, empty, filtered-empty, error, offline and partial.
 */
const COLUMNS = layout.closetColumns;

/** Skeletons shaped like the real content — never a centred spinner. */
export function ClosetGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.skeletonGrid} accessibilityLabel="Loading your closet">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.skeletonTile}>
          <View style={styles.skeletonImage} />
          <View style={[styles.skeletonBar, { width: '45%' }]} />
          <View style={[styles.skeletonBar, { width: '70%' }]} />
        </View>
      ))}
    </View>
  );
}

export type ClosetStateProps = {
  message: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** A warm sentence plus one obvious route out. Never "No data". */
export function ClosetState({ message, hint, actionLabel, onAction }: ClosetStateProps) {
  return (
    <View style={styles.state}>
      <Text style={styles.stateMessage}>{message}</Text>
      {hint ? <Text style={styles.stateHint}>{hint}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable style={styles.stateButton} onPress={onAction} accessibilityRole="button">
          <Text style={styles.stateButtonLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export type ClosetGridProps = {
  garments: Garment[];
  isLoading: boolean;
  error: unknown;
  hasFilters: boolean;
  isFetchingNextPage: boolean;
  onEndReached: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onPressGarment: (id: string) => void;
  onToggleFavorite: (id: string, favorite: boolean) => void;
  onClearFilters: () => void;
  onAddFirst: () => void;
  header?: React.ReactElement;
  /**
   * Captures that exist on the device but not yet on the server (task 2.6).
   *
   * Rendered ABOVE the fetched garments and outside the list, so a photo
   * taken thirty seconds ago is where the user expects it — at the top —
   * without pretending to be a paged result it would then fight with.
   */
  pending?: React.ReactElement | null;
};

export function ClosetGrid(props: ClosetGridProps) {
  // Pending captures ride with the header so they appear in every state — a
  // photo taken while offline must be visible on the error screen too, which is
  // exactly when the user most needs to know it was not lost.
  const header = (
    <>
      {props.header}
      {props.pending}
    </>
  );

  const renderItem = useCallback(
    ({ item }: { item: Garment }) => (
      <View style={styles.cell}>
        <GarmentTile
          garment={item}
          onPress={props.onPressGarment}
          onToggleFavorite={props.onToggleFavorite}
        />
      </View>
    ),
    [props.onPressGarment, props.onToggleFavorite],
  );

  const keyExtractor = useCallback((item: Garment) => item.id, []);

  // --- error, including offline ------------------------------------------
  if (props.error && props.garments.length === 0) {
    const apiError = props.error instanceof ApiError ? props.error : null;

    // Offline is not a failure: the closet stays browsable from cache, and this
    // only shows when there is nothing cached to show (REL-1).
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        {header}
        <ClosetState
          message={apiError?.isOffline ? "You're offline." : "We couldn't load your closet."}
          hint={
            apiError?.isOffline
              ? "We'll finish this when you're back."
              : (apiError?.message ?? 'Something went wrong on our side.')
          }
          actionLabel="Try again"
          onAction={props.onRefresh}
        />
      </ScrollView>
    );
  }

  // --- loading -------------------------------------------------------------
  if (props.isLoading && props.garments.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        {header}
        <ClosetGridSkeleton />
      </ScrollView>
    );
  }

  // --- empty ---------------------------------------------------------------
  // "You have nothing" is a lie if a capture is queued: the user just took a
  // photo, and it is rendered in the header above.
  if (props.garments.length === 0 && !props.pending) {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        {header}
        {props.hasFilters ? (
          <ClosetState
            message="No pieces match those filters."
            actionLabel="Clear filters"
            onAction={props.onClearFilters}
          />
        ) : (
          <ClosetState
            message="Your closet is empty."
            hint="Let's find what you already own — Mira works out the rest."
            actionLabel="Add your first piece"
            onAction={props.onAddFirst}
          />
        )}
      </ScrollView>
    );
  }

  // --- results -------------------------------------------------------------
  return (
    <FlashList
      data={props.garments}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={COLUMNS}
      ListHeaderComponent={header}
      contentContainerStyle={styles.listContent}
      onEndReached={props.onEndReached}
      onEndReachedThreshold={0.6}
      onRefresh={props.onRefresh}
      refreshing={props.isRefreshing}
      showsVerticalScrollIndicator={false}
      ListFooterComponent={
        props.isFetchingNextPage ? (
          <View style={styles.footer}>
            <ActivityIndicator color={color.textSecondary} />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: space.screenX, paddingBottom: space.giant },
  listContent: { paddingHorizontal: space.screenX, paddingBottom: space.giant },
  cell: { flex: 1, paddingHorizontal: space.gridGap / 2 },
  footer: { paddingVertical: space.xxl, alignItems: 'center' },

  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.gridGap / 2 },
  skeletonTile: {
    width: `${100 / COLUMNS}%`,
    paddingHorizontal: space.gridGap / 2,
    marginBottom: space.xxl,
  },
  skeletonImage: {
    width: '100%',
    aspectRatio: layout.garmentAspectRatio,
    borderRadius: radius.md,
    backgroundColor: color.surfaceSunken,
  },
  skeletonBar: {
    height: space.md,
    marginTop: space.sm,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceSunken,
  },

  state: { paddingVertical: space.massive, alignItems: 'flex-start' },
  stateMessage: {
    fontSize: type.title3.fontSize,
    lineHeight: type.title3.lineHeight,
    fontWeight: type.title3.fontWeight,
    color: color.text,
  },
  stateHint: {
    marginTop: space.sm,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: color.textSecondary,
  },
  stateButton: {
    marginTop: space.xl,
    minHeight: space.tapMin,
    paddingHorizontal: space.xl,
    justifyContent: 'center',
    backgroundColor: color.inverseBg,
    borderRadius: radius.md,
  },
  stateButtonLabel: {
    color: color.inverseText,
    fontSize: type.bodyStrong.fontSize,
    fontWeight: type.bodyStrong.fontWeight,
  },
});
