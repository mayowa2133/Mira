import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import { ClosetGridSkeleton, ClosetState } from '@/features/closet/ClosetGrid';
import { GarmentRail } from '@/features/wardrobe/GarmentRail';
import { SimilarOwnedSection } from '@/features/wardrobe/SimilarOwnedSection';
import {
  useInsights,
  useSimilarOwned,
  useWardrobeStats,
  type Insight,
} from '@/features/wardrobe/queries';
import { describeLoadFailure } from '@/features/closet/load-failure';

/**
 * Wardrobe insights (`docs/02-design/screen-specs.md` §26).
 *
 * > Fashion content, not a dashboard. Numbers stay secondary to imagery.
 *
 * Which is why closet value and cost per wear are collapsed by default and sit
 * at the bottom: they are the most dashboard-like thing here, and a wardrobe is
 * not a balance sheet. Everything above them is a sentence and some pictures.
 *
 * The server omits any insight the closet cannot support, so a new closet gets
 * an invitation rather than a page of empty sections.
 */
export default function InsightsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [numbersOpen, setNumbersOpen] = useState(false);

  const insights = useInsights();
  const stats = useWardrobeStats();
  const similar = useSimilarOwned();

  const failure = describeLoadFailure(insights.error, {
    message: "We couldn't look through your closet.",
  });

  const openGarment = (id: string) => router.push(`/garment/${id}`);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.md}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Your closet lately
        </Text>
      </View>

      {insights.isPending ? (
        <ClosetGridSkeleton count={4} />
      ) : failure ? (
        <ClosetState
          message={failure.message}
          hint={failure.hint}
          actionLabel={failure.actionLabel}
          onAction={() => void insights.refetch()}
        />
      ) : (insights.data ?? []).length === 0 ? (
        // Not "no insights": a young closet has nothing to say about itself
        // yet, and saying so as a failure would be a reproach.
        <ClosetState
          message="Nothing to report yet."
          hint="Once you have worn a few things, Mira starts noticing patterns."
          actionLabel="Add a piece"
          onAction={() => router.push('/add')}
        />
      ) : (
        (insights.data ?? []).map((insight) => (
          <InsightSection key={insight.kind} insight={insight} onPressGarment={openGarment} />
        ))
      )}

      {/* §26 places this among the insights, not with the numbers: it is
          content about two garments, not a statistic. */}
      <SimilarOwnedSection pairs={similar.data ?? []} onPressGarment={openGarment} />

      {/* §27 lives one tap from here: the question "when did I last wear this"
          is the same question the rest of this screen is answering. */}
      <Pressable
        style={styles.historyLink}
        onPress={() => router.push('/wear-history')}
        accessibilityRole="button"
        testID="open-wear-history"
      >
        <Text style={styles.historyLabel}>What you wore</Text>
        <Text style={styles.historyChevron}>›</Text>
      </Pressable>

      {/* Optional, collapsed by default (§26). */}
      {stats.data ? (
        <View style={styles.numbers}>
          <Pressable
            style={styles.numbersToggle}
            onPress={() => setNumbersOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: numbersOpen }}
            accessibilityLabel={numbersOpen ? 'Hide the numbers' : 'Show the numbers'}
          >
            <Text style={styles.numbersTitle}>The numbers</Text>
            <Text style={styles.numbersChevron}>{numbersOpen ? '−' : '+'}</Text>
          </Pressable>

          {numbersOpen ? (
            <View style={styles.numbersBody}>
              <Text style={styles.numbersLine}>
                {formatMoney(stats.data.closet_value.total, stats.data.closet_value.currency)}{' '}
                across {stats.data.closet_value.priced_pieces} pieces
              </Text>
              {/* Stated, so the total reads as covering part of the closet
                  rather than all of it. */}
              {stats.data.closet_value.unpriced_pieces > 0 ? (
                <Text style={styles.numbersNote}>
                  {stats.data.closet_value.unpriced_pieces} pieces have no price yet
                </Text>
              ) : null}

              {stats.data.cost_per_wear.average !== null ? (
                <>
                  <Text style={[styles.numbersLine, styles.numbersSpaced]}>
                    {formatMoney(
                      stats.data.cost_per_wear.average,
                      stats.data.cost_per_wear.currency,
                    )}{' '}
                    a wear, on average
                  </Text>
                  <Text style={styles.numbersNote}>
                    Across {stats.data.cost_per_wear.based_on_pieces} pieces you have worn
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

/**
 * One insight.
 *
 * `most_loved` is a hero image rather than a rail — §26 shows it full width
 * with the piece named underneath, because a single beloved garment is a
 * portrait, not a carousel of one.
 */
function InsightSection({
  insight,
  onPressGarment,
}: {
  insight: Insight;
  onPressGarment: (id: string) => void;
}) {
  if (insight.kind === 'most_loved') {
    const piece = insight.garments[0];
    if (!piece) return null;

    const title = [piece.brand, piece.name].filter(Boolean).join(' ') || 'This one';

    return (
      <View style={styles.hero}>
        <Text style={styles.headline} accessibilityRole="header">
          {insight.headline}
        </Text>
        <Pressable
          onPress={() => onPressGarment(piece.id)}
          accessibilityRole="button"
          accessibilityLabel={`${title}, worn ${piece.worn_count} times`}
        >
          {piece.image_url ? (
            <Image
              style={styles.heroImage}
              source={{ uri: piece.image_url }}
              contentFit="cover"
              transition={160}
              accessible={false}
            />
          ) : (
            <View style={styles.heroImage} />
          )}
          <Text style={styles.heroCaption}>
            {title} · Worn {piece.worn_count} {piece.worn_count === 1 ? 'time' : 'times'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <GarmentRail
      headline={insight.headline}
      garments={insight.garments}
      total={insight.total}
      onPressGarment={onPressGarment}
    />
  );
}

function formatMoney(amount: number, currency: string | null): string {
  const rounded = Math.round(amount * 100) / 100;
  if (!currency) return String(rounded);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    }).format(rounded);
  } catch {
    // An unknown currency code should not blank the screen.
    return `${rounded} ${currency}`;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  content: { paddingBottom: space.giant },

  header: { paddingHorizontal: space.screenX, marginBottom: space.xxl },
  back: { fontSize: 30, lineHeight: 34, color: color.text, marginBottom: space.sm },
  title: {
    fontSize: type.display.fontSize,
    lineHeight: type.display.lineHeight,
    fontWeight: type.display.fontWeight,
    letterSpacing: type.display.letterSpacing,
    color: color.text,
  },

  headline: {
    paddingHorizontal: space.screenX,
    marginBottom: space.md,
    fontSize: type.title3.fontSize,
    lineHeight: type.title3.lineHeight,
    fontWeight: type.title3.fontWeight,
    color: color.text,
  },

  hero: { marginBottom: space.xxl },
  heroImage: {
    marginHorizontal: space.screenX,
    aspectRatio: 0.82,
    borderRadius: radius.lg,
    backgroundColor: color.surfaceSunken,
  },
  heroCaption: {
    marginTop: space.md,
    paddingHorizontal: space.screenX,
    fontSize: type.body.fontSize,
    color: color.textSecondary,
  },

  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: space.screenX,
    minHeight: space.tapMin,
  },
  historyLabel: { fontSize: type.body.fontSize, color: color.text },
  historyChevron: { fontSize: type.body.fontSize, color: color.textTertiary },

  numbers: {
    marginTop: space.lg,
    marginHorizontal: space.screenX,
    borderTopWidth: 1,
    borderTopColor: color.divider,
  },
  numbersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: space.tapMin,
  },
  numbersTitle: { fontSize: type.body.fontSize, color: color.textSecondary },
  numbersChevron: { fontSize: type.body.fontSize, color: color.textSecondary },
  numbersBody: { paddingBottom: space.lg },
  numbersLine: { fontSize: type.body.fontSize, color: color.text },
  numbersSpaced: { marginTop: space.md },
  numbersNote: { marginTop: space.xs, fontSize: type.caption.fontSize, color: color.textTertiary },
});
