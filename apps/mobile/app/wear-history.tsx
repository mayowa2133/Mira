import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import { ClosetGridSkeleton, ClosetState } from '@/features/closet/ClosetGrid';
import { describeLoadFailure } from '@/features/closet/load-failure';
import { useWearHistory } from '@/features/wardrobe/queries';
import {
  WEEKDAY_LABELS,
  monthGrid,
  monthLabel,
  monthRange,
  shiftMonth,
  type CalendarCell,
} from '@/features/wardrobe/calendar';

/**
 * Wear history (§27, task 9.5).
 *
 * > Calendar or timeline of what was worn when, with garment thumbnails per
 * > day. Tapping a day shows the look or the individual garments.
 *
 * A calendar rather than a timeline, because the question this answers is
 * "when did I last wear this" and a month grid makes gaps visible in a way a
 * list does not — an empty fortnight looks like an empty fortnight.
 *
 * Each day cell shows the first garment's thumbnail, not a count. §26's rule
 * that numbers stay secondary to imagery applies here too.
 */
export default function WearHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const today = new Date();
  const [{ year, month }, setMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [selected, setSelected] = useState<string | null>(null);

  const range = useMemo(() => monthRange(year, month), [year, month]);
  const history = useWearHistory(range);

  const cells = useMemo(
    () => monthGrid(year, month, history.data ?? []),
    [year, month, history.data],
  );

  const failure = describeLoadFailure(history.error, {
    message: "We couldn't load your wear history.",
  });

  const open = selected ? (cells.find((c) => c.date === selected)?.wears ?? null) : null;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
    >
      <Pressable onPress={() => router.back()} hitSlop={space.md} accessibilityLabel="Back">
        <Text style={styles.back}>‹</Text>
      </Pressable>
      <Text style={styles.title} accessibilityRole="header">
        What you wore
      </Text>

      <View style={styles.monthRow}>
        <Pressable
          onPress={() => setMonth(shiftMonth(year, month, -1))}
          hitSlop={space.md}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          testID="month-back"
        >
          <Text style={styles.step}>‹</Text>
        </Pressable>
        <Text style={styles.month}>{monthLabel(year, month)}</Text>
        <Pressable
          onPress={() => setMonth(shiftMonth(year, month, 1))}
          hitSlop={space.md}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          testID="month-forward"
        >
          <Text style={styles.step}>›</Text>
        </Pressable>
      </View>

      {history.isPending ? (
        <ClosetGridSkeleton count={2} />
      ) : failure ? (
        <ClosetState
          message={failure.message}
          hint={failure.hint}
          actionLabel={failure.actionLabel}
          onAction={() => void history.refetch()}
        />
      ) : (
        <>
          <View style={styles.weekdays}>
            {WEEKDAY_LABELS.map((label, index) => (
              <Text key={index} style={styles.weekday} accessible={false}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((cell, index) => (
              <Cell
                key={cell.date ?? `pad-${index}`}
                cell={cell}
                selected={cell.date === selected}
                onPress={() => setSelected(cell.date)}
              />
            ))}
          </View>

          {/* Nothing worn this month is a fact, not a failure — and it is the
              normal state before anyone has marked anything worn. */}
          {(history.data ?? []).length === 0 ? (
            <Text style={styles.nothing}>Nothing marked worn this month.</Text>
          ) : null}

          {open ? (
            <View style={styles.day}>
              <Text style={styles.dayTitle}>{formatDay(open.worn_on)}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dayRail}
              >
                {open.garments.map((garment) => (
                  <Pressable
                    key={garment.id}
                    onPress={() => router.push(`/garment/${garment.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      [garment.brand, garment.name].filter(Boolean).join(' ') || 'A piece'
                    }
                  >
                    {garment.image_url ? (
                      <Image
                        style={styles.dayImage}
                        source={{ uri: garment.image_url }}
                        contentFit="cover"
                        accessible={false}
                      />
                    ) : (
                      <View style={styles.dayImage} />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function Cell({
  cell,
  selected,
  onPress,
}: {
  cell: CalendarCell;
  selected: boolean;
  onPress: () => void;
}) {
  if (cell.day === null) return <View style={styles.cell} />;

  const first = cell.wears?.garments[0];
  const count = cell.wears?.garments.length ?? 0;

  return (
    <Pressable
      style={[styles.cell, selected && styles.cellSelected]}
      onPress={onPress}
      disabled={count === 0}
      accessibilityRole="button"
      accessibilityLabel={
        count === 0
          ? `${cell.day}, nothing worn`
          : `${cell.day}, ${count} ${count === 1 ? 'piece' : 'pieces'} worn`
      }
      testID={count > 0 ? 'wear-day' : undefined}
    >
      {first?.image_url ? (
        <Image
          style={styles.cellImage}
          source={{ uri: first.image_url }}
          contentFit="cover"
          accessible={false}
        />
      ) : null}
      {/* A chip, not bare white text over the photograph. The number is white
          for contrast against a garment, and a white shirt would otherwise
          make it invisible — which only shows up with real imagery. */}
      <View style={count > 0 ? styles.cellDayChip : undefined}>
        <Text style={[styles.cellDay, count > 0 && styles.cellDayWorn]}>{cell.day}</Text>
      </View>
    </Pressable>
  );
}

function formatDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.screenX, paddingBottom: space.giant },
  back: { fontSize: 30, lineHeight: 34, color: color.text },
  title: {
    marginTop: space.sm,
    fontSize: type.display.fontSize,
    lineHeight: type.display.lineHeight,
    fontWeight: type.display.fontWeight,
    letterSpacing: type.display.letterSpacing,
    color: color.text,
  },

  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xl,
    marginBottom: space.md,
  },
  month: { fontSize: type.title3.fontSize, fontWeight: type.title3.fontWeight, color: color.text },
  step: { fontSize: 24, color: color.text, paddingHorizontal: space.md },

  weekdays: { flexDirection: 'row', marginBottom: space.xs },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: type.caption.fontSize,
    color: color.textTertiary,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 0.85,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: { opacity: 0.6 },
  cellImage: {
    position: 'absolute',
    top: 2,
    right: 2,
    bottom: 2,
    left: 2,
    borderRadius: radius.sm,
  },
  cellDay: { fontSize: type.caption.fontSize, color: color.textTertiary },
  cellDayWorn: { color: color.inverseText, fontWeight: '600' },
  cellDayChip: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    // The same scrim the camera uses to carry white text over a photograph.
    // Dark enough for any garment, sheer enough not to fight the image.
    backgroundColor: color.cameraScrim,
  },

  nothing: {
    marginTop: space.xl,
    textAlign: 'center',
    fontSize: type.subhead.fontSize,
    color: color.textSecondary,
  },

  day: { marginTop: space.xxl },
  dayTitle: {
    marginBottom: space.md,
    fontSize: type.title3.fontSize,
    fontWeight: type.title3.fontWeight,
    color: color.text,
  },
  dayRail: { gap: space.sm },
  dayImage: {
    width: 88,
    aspectRatio: 0.78,
    borderRadius: radius.md,
    backgroundColor: color.surfaceSunken,
  },
});
