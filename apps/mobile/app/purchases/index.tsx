import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import { ClosetGridSkeleton, ClosetState } from '@/features/closet/ClosetGrid';
import { describeLoadFailure } from '@/features/closet/load-failure';
import {
  useAnswerCandidate,
  useAnswerMany,
  usePurchaseCandidates,
  type PurchaseCandidate,
} from '@/features/purchases/queries';
import {
  OWNERSHIP_ANSWERS,
  candidateLabel,
  footerLabel,
  headerLabel,
  retailerCounts,
  toggleSelection,
} from '@/features/purchases/review';

/**
 * Purchase review (§8, task 8.5). Reference 01 — the Fashion Nova grid.
 *
 * Two columns of candidates with a selection tick, a retailer strip that
 * filters, and a sticky footer with a live count. Tapping a tile opens the
 * ownership sheet rather than selecting it, because the five answers are the
 * point — selection exists for the one answer people give in bulk.
 *
 * Nothing produces candidates yet: `email.scan` is Phase 8's AI half and the
 * receipt parser is 4.4. The empty state says so plainly rather than implying
 * the account is empty.
 */
export default function PurchaseReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const candidates = usePurchaseCandidates();
  const answerMany = useAnswerMany();

  const [selected, setSelected] = useState<string[]>([]);
  const [retailer, setRetailer] = useState<string | null | undefined>(undefined);
  const [sheetFor, setSheetFor] = useState<PurchaseCandidate | null>(null);

  const all = candidates.data?.data ?? [];
  const shown = useMemo(
    () => (retailer === undefined ? all : all.filter((c) => c.retailer === retailer)),
    [all, retailer],
  );
  const retailers = useMemo(() => retailerCounts(all), [all]);

  const failure = describeLoadFailure(candidates.error, {
    message: "We couldn't load your purchases.",
  });

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}>
        <Pressable onPress={() => router.back()} hitSlop={space.md} accessibilityLabel="Back">
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {headerLabel(candidates.data?.total ?? 0)}
        </Text>

        {candidates.isPending ? (
          <ClosetGridSkeleton count={4} />
        ) : failure ? (
          <ClosetState
            message={failure.message}
            hint={failure.hint}
            actionLabel={failure.actionLabel}
            onAction={() => void candidates.refetch()}
          />
        ) : all.length === 0 ? (
          <ClosetState
            message="No purchases to review."
            // Honest about why, rather than implying the account is empty.
            hint="Connecting email and reading receipts are still being built. Until then, purchases arrive when you add them yourself."
            actionLabel="Add a piece"
            onAction={() => router.push('/add')}
          />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.strip}
            >
              <Chip
                label={`All ${all.length}`}
                active={retailer === undefined}
                onPress={() => setRetailer(undefined)}
              />
              {retailers.map((entry) => (
                <Chip
                  key={entry.retailer ?? 'unknown'}
                  label={`${entry.retailer ?? 'Unknown'} ${entry.count}`}
                  active={retailer === entry.retailer}
                  onPress={() => setRetailer(entry.retailer)}
                />
              ))}
            </ScrollView>

            <View style={styles.grid}>
              {shown.map((candidate) => (
                <Tile
                  key={candidate.id}
                  candidate={candidate}
                  selected={selected.includes(candidate.id)}
                  onToggle={() => setSelected((s) => toggleSelection(s, candidate.id))}
                  onOpen={() => setSheetFor(candidate)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {all.length > 0 ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <Pressable
            style={[styles.cta, selected.length === 0 && styles.ctaDisabled]}
            disabled={selected.length === 0 || answerMany.isPending}
            onPress={() =>
              answerMany.mutate(
                { ids: selected, status: 'confirmed_owned' },
                { onSuccess: () => setSelected([]) },
              )
            }
            accessibilityRole="button"
            accessibilityLabel={footerLabel(selected.length)}
            testID="add-selected"
          >
            <Text style={styles.ctaLabel}>{footerLabel(selected.length)}</Text>
          </Pressable>

          {/* Both halves reported (A-03). */}
          {answerMany.data && answerMany.data.failed.length > 0 ? (
            <Text style={styles.partial}>
              {answerMany.data.updated.length} added · {answerMany.data.failed.length} need a look
            </Text>
          ) : null}
        </View>
      ) : null}

      {sheetFor ? <OwnershipSheet candidate={sheetFor} onClose={() => setSheetFor(null)} /> : null}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}${active ? ', selected' : ''}`}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function Tile({
  candidate,
  selected,
  onToggle,
  onOpen,
}: {
  candidate: PurchaseCandidate;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const label = candidateLabel(candidate);

  return (
    <View style={styles.cell}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={label}
        // Selection is the secondary control, so it is a custom action rather
        // than a nested pressable — the same reason a closet tile's favourite
        // is (D-016).
        accessibilityActions={[{ name: 'select', label: selected ? 'Deselect' : 'Select' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'select') onToggle();
        }}
        testID="candidate-tile"
      >
        {candidate.image_url ? (
          <Image
            style={styles.image}
            source={{ uri: candidate.image_url }}
            contentFit="cover"
            accessible={false}
          />
        ) : (
          <View style={styles.image} />
        )}
      </Pressable>

      <Pressable
        style={[styles.tick, selected && styles.tickOn]}
        onPress={onToggle}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={[styles.tickMark, selected && styles.tickMarkOn]}>✓</Text>
      </Pressable>

      <Text style={styles.cellLabel} numberOfLines={2}>
        {label}
      </Text>
      {candidate.price ? (
        <Text style={styles.cellMeta}>
          {candidate.price.amount} {candidate.price.currency}
        </Text>
      ) : null}
    </View>
  );
}

/** §8's five answers. */
function OwnershipSheet({
  candidate,
  onClose,
}: {
  candidate: PurchaseCandidate;
  onClose: () => void;
}) {
  const answer = useAnswerCandidate();

  return (
    <View style={styles.sheet}>
      <Text style={styles.sheetTitle}>{candidateLabel(candidate)}</Text>
      {candidate.retailer ? <Text style={styles.sheetMeta}>{candidate.retailer}</Text> : null}

      {OWNERSHIP_ANSWERS.map((option) => (
        <Pressable
          key={option.key}
          style={styles.answer}
          disabled={answer.isPending}
          onPress={() =>
            answer.mutate({ id: candidate.id, status: option.status }, { onSuccess: onClose })
          }
          accessibilityRole="button"
          testID={`ownership-${option.key}`}
        >
          <Text style={styles.answerLabel}>{option.label}</Text>
        </Pressable>
      ))}

      {answer.error ? (
        <Text style={styles.sheetError}>
          {describeLoadFailure(answer.error, { message: "That didn't work." })?.message}
        </Text>
      ) : null}

      <Pressable style={styles.cancel} onPress={onClose} accessibilityRole="button">
        <Text style={styles.cancelLabel}>Not now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.screenX, paddingBottom: space.giant },
  back: { fontSize: 30, lineHeight: 34, color: color.text },
  title: {
    marginTop: space.sm,
    marginBottom: space.lg,
    fontSize: type.display.fontSize,
    lineHeight: type.display.lineHeight,
    fontWeight: type.display.fontWeight,
    color: color.text,
  },

  strip: { gap: space.sm, paddingBottom: space.lg },
  chip: {
    paddingHorizontal: space.md,
    minHeight: space.tapMin,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: color.divider,
  },
  chipActive: { backgroundColor: color.accent, borderColor: color.accent },
  chipLabel: { fontSize: type.subhead.fontSize, color: color.textSecondary },
  chipLabelActive: { color: color.inverseText },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cell: { width: '47%' },
  image: {
    width: '100%',
    aspectRatio: 0.78,
    borderRadius: radius.md,
    backgroundColor: color.surfaceSunken,
  },
  tick: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glass,
  },
  tickOn: { backgroundColor: color.text },
  tickMark: { fontSize: 15, color: color.textTertiary },
  tickMarkOn: { color: color.inverseText },
  cellLabel: { marginTop: space.sm, fontSize: type.subhead.fontSize, color: color.text },
  cellMeta: { marginTop: space.xxs, fontSize: type.caption.fontSize, color: color.textSecondary },

  footer: {
    paddingHorizontal: space.screenX,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.divider,
    backgroundColor: color.bg,
  },
  cta: {
    minHeight: space.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: color.text,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaLabel: { fontSize: type.body.fontSize, color: color.inverseText },
  partial: {
    marginTop: space.sm,
    textAlign: 'center',
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: space.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.divider,
  },
  sheetTitle: {
    fontSize: type.title3.fontSize,
    fontWeight: type.title3.fontWeight,
    color: color.text,
  },
  sheetMeta: { marginTop: space.xxs, fontSize: type.caption.fontSize, color: color.textSecondary },
  answer: {
    marginTop: space.sm,
    minHeight: space.tapMin,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.divider,
  },
  answerLabel: { fontSize: type.body.fontSize, color: color.text },
  sheetError: { marginTop: space.md, fontSize: type.caption.fontSize, color: color.textSecondary },
  cancel: {
    marginTop: space.lg,
    minHeight: space.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: { fontSize: type.subhead.fontSize, color: color.textSecondary },
});
