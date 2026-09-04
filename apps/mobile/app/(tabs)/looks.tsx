import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import { ClosetGridSkeleton, ClosetState } from '@/features/closet/ClosetGrid';
import { LookCard } from '@/features/outfits/LookCard';
import { useOutfits, type Outfit, type OutfitTab } from '@/features/outfits/queries';
import { describeLoadFailure } from '@/features/closet/load-failure';

/**
 * Looks library (`docs/02-design/screen-specs.md` §22).
 *
 * Pinterest-style masonry, Reference 04. Cards are non-uniform because they are
 * looks, not standardized products — so this uses two independent columns
 * rather than a row grid, and each column grows to whatever its cards need.
 *
 * Every tab has its own empty state WITH A ROUTE OUT: an empty tab that only
 * says "nothing here" tells the user they have failed at something.
 */
const TABS: { key: OutfitTab; label: string }[] = [
  { key: 'saved', label: 'Saved' },
  { key: 'worn', label: 'Worn' },
  { key: 'mira', label: 'Mira' },
  { key: 'mine', label: 'Mine' },
];

/** Each tab is a different absence, so each gets its own way forward. */
const EMPTY: Record<OutfitTab, { message: string; hint?: string; action: string; to: string }> = {
  saved: {
    message: 'Nothing saved yet.',
    hint: 'Tap the heart on a look to keep it here.',
    action: 'Build a look',
    to: '/outfit/new',
  },
  worn: {
    message: "You haven't worn a look yet.",
    hint: 'Mark a look worn and it will show up here.',
    action: 'See your looks',
    to: '/looks',
  },
  mira: {
    message: 'Mira has not styled anything yet.',
    hint: 'Ask for a look and it will appear here.',
    action: 'Ask Mira',
    to: '/mira',
  },
  mine: {
    message: 'No looks yet.',
    hint: 'Put a few pieces together and save them as a look.',
    action: 'Build a look',
    to: '/outfit/new',
  },
};

export default function LooksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // The first tab, as §22 lists them. It opened on `mine` — the fourth — which
  // contradicted the visual order for no stated reason, and meant a tap on
  // Looks landed somewhere other than where the eye starts.
  const [tab, setTab] = useState<OutfitTab>('saved');

  const outfits = useOutfits(tab);

  // Named for what failed, so "We couldn't load your looks" survives the move
  // onto the shared helper.
  const failure = describeLoadFailure(outfits.error, 'your looks');
  const open = useCallback((id: string) => router.push(`/look/${id}`), [router]);

  // Two columns, filled by whichever is currently shorter, so uneven cards do
  // not leave one side trailing.
  const columns = useMemo(() => {
    const left: Outfit[] = [];
    const right: Outfit[] = [];
    let leftWeight = 0;
    let rightWeight = 0;

    for (const outfit of outfits.data ?? []) {
      const weight = Math.max(1, Math.min(outfit.items.length, 4));
      if (leftWeight <= rightWeight) {
        left.push(outfit);
        leftWeight += weight;
      } else {
        right.push(outfit);
        rightWeight += weight;
      }
    }
    return { left, right };
  }, [outfits.data]);

  const empty = EMPTY[tab];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            Looks
          </Text>
          <Pressable
            onPress={() => router.push('/outfit/new')}
            style={styles.add}
            accessibilityRole="button"
            accessibilityLabel="Build a look"
          >
            <Text style={styles.addLabel}>+ Build</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {TABS.map((entry) => {
            const active = entry.key === tab;
            return (
              <Pressable
                key={entry.key}
                onPress={() => setTab(entry.key)}
                style={[styles.tab, active && styles.tabActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${entry.label}${active ? ', selected' : ''}`}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {entry.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={outfits.isRefetching}
            onRefresh={() => void outfits.refetch()}
          />
        }
      >
        {outfits.isPending ? (
          <ClosetGridSkeleton count={4} />
        ) : failure ? (
          <ClosetState
            message={failure.message}
            hint={failure.hint}
            actionLabel={failure.actionLabel}
            onAction={() => void outfits.refetch()}
          />
        ) : (outfits.data ?? []).length === 0 ? (
          <ClosetState
            message={empty.message}
            {...(empty.hint ? { hint: empty.hint } : {})}
            actionLabel={empty.action}
            onAction={() => router.push(empty.to as never)}
          />
        ) : (
          <View style={styles.masonry}>
            <View style={styles.column}>
              {columns.left.map((outfit) => (
                <View key={outfit.id} style={styles.cell}>
                  <LookCard outfit={outfit} onPress={open} />
                </View>
              ))}
            </View>
            <View style={styles.column}>
              {columns.right.map((outfit) => (
                <View key={outfit.id} style={styles.cell}>
                  <LookCard outfit={outfit} onPress={open} />
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  header: { paddingTop: space.lg, paddingBottom: space.sm },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.screenX,
  },
  title: {
    fontSize: type.title1.fontSize,
    lineHeight: type.title1.lineHeight,
    fontWeight: type.title1.fontWeight,
    color: color.text,
  },
  add: { minHeight: space.tapMin, justifyContent: 'center' },
  addLabel: { fontSize: type.body.fontSize, color: color.text },

  tabRow: { paddingHorizontal: space.screenX, gap: space.sm, paddingTop: space.md },
  tab: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
  },
  tabActive: { backgroundColor: color.accentSoft, borderColor: color.accentSoft },
  tabLabel: { fontSize: type.subhead.fontSize, color: color.textSecondary },
  tabLabelActive: { color: color.text },

  content: { paddingHorizontal: space.screenX, paddingBottom: space.giant },
  masonry: { flexDirection: 'row', gap: space.md, paddingTop: space.md },
  column: { flex: 1 },
  cell: { marginBottom: space.lg },
});
