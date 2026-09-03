import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, OCCASIONS, SEASONS } from '@mira/taxonomy';
import { color, radius, space, type } from '@mira/ui';
import { ChipMultiSelect, ColorSelect, type ChipOption } from '@/ui/Fields';
import {
  EMPTY_FILTERS,
  colorOptions,
  countActive,
  ctaLabel,
  isEmpty,
  toQueryFilters,
  toggleValue,
  type FilterState,
} from './filter-state';
import { useGarmentCount } from './queries';

/**
 * Filter sheet (`docs/02-design/screen-specs.md` §16, Reference 03 — SSENSE).
 *
 * Two rules from the spec shape this screen:
 *
 *   - Filters apply on the CTA, not on every tap. Re-running the whole page on
 *     each selection is exactly what the mobile filtering research advises
 *     against, and it makes multi-select miserable.
 *   - The CTA shows a LIVE count, so the user knows what they are about to get
 *     before committing. That count comes from `/garments/count`, which shares
 *     `applyDefaults` with the list so the two can never disagree.
 */
const titleCase = (value: string): string =>
  value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const asOptions = (values: readonly string[]): ChipOption[] =>
  values.map((value) => ({ value, label: titleCase(value) }));

const CATEGORY_OPTIONS = asOptions(CATEGORIES);
const SEASON_OPTIONS = asOptions(SEASONS);
const OCCASION_OPTIONS = asOptions(OCCASIONS);
const COLOR_OPTIONS = colorOptions();

const STATUS_TOGGLES = [
  { key: 'neverWorn', label: 'Never worn' },
  { key: 'tagsAttached', label: 'Still has tags' },
  { key: 'favorite', label: 'Favourite' },
  { key: 'laundry', label: 'In the laundry' },
] as const;

export type FilterSheetProps = {
  visible: boolean;
  initial: FilterState;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
};

export function FilterSheet({ visible, initial, onClose, onApply }: FilterSheetProps) {
  const insets = useSafeAreaInsets();

  // Draft state: nothing reaches the grid until the CTA is tapped, and
  // dismissing the sheet discards the draft.
  const [draft, setDraft] = useState<FilterState>(initial);

  // Re-seed the draft whenever the sheet is opened with different applied
  // filters, so it always reflects what is actually on the grid.
  const [seededFrom, setSeededFrom] = useState<FilterState>(initial);
  if (visible && seededFrom !== initial) {
    setSeededFrom(initial);
    setDraft(initial);
  }

  const queryFilters = useMemo(() => toQueryFilters(draft), [draft]);
  const count = useGarmentCount(queryFilters);

  const toggleList = useCallback(
    (field: 'category' | 'color' | 'season' | 'occasion') => (value: string) => {
      setDraft((prev) => ({ ...prev, [field]: toggleValue(prev[field], value) }));
    },
    [],
  );

  const toggleFlag = useCallback(
    (key: (typeof STATUS_TOGGLES)[number]['key']) => () => {
      setDraft((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [],
  );

  const handleReset = useCallback(() => setDraft(EMPTY_FILTERS), []);
  const handleApply = useCallback(() => onApply(draft), [draft, onApply]);

  const active = countActive(draft);
  // While a count is refetching the previous number is still meaningful, so the
  // CTA does not flicker between a number and a placeholder on every tap.
  const shownCount = count.data?.count;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
          <Pressable
            onPress={onClose}
            style={styles.headerButton}
            hitSlop={space.md}
            accessibilityRole="button"
            accessibilityLabel="Close filters"
          >
            <Text style={styles.headerGlyph}>×</Text>
          </Pressable>

          <Text style={styles.title} accessibilityRole="header">
            Filter
          </Text>

          <Pressable
            onPress={handleReset}
            disabled={isEmpty(draft)}
            style={styles.headerButton}
            hitSlop={space.md}
            accessibilityRole="button"
            accessibilityLabel="Reset filters"
            accessibilityState={{ disabled: isEmpty(draft) }}
          >
            <Text style={[styles.reset, isEmpty(draft) && styles.resetDisabled]}>Reset</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ChipMultiSelect
            label="Category"
            options={CATEGORY_OPTIONS}
            values={draft.category}
            onToggle={toggleList('category')}
          />

          <ColorSelect
            label="Colour"
            options={COLOR_OPTIONS}
            values={draft.color}
            onToggle={toggleList('color')}
          />

          <ChipMultiSelect
            label="Occasion"
            options={OCCASION_OPTIONS}
            values={draft.occasion}
            onToggle={toggleList('occasion')}
          />

          <ChipMultiSelect
            label="Season"
            options={SEASON_OPTIONS}
            values={draft.season}
            onToggle={toggleList('season')}
          />

          <Text style={styles.groupLabel}>Status</Text>
          <View style={styles.statusWrap}>
            {STATUS_TOGGLES.map((toggle) => {
              const on = draft[toggle.key];
              return (
                <Pressable
                  key={toggle.key}
                  onPress={toggleFlag(toggle.key)}
                  style={[styles.statusChip, on && styles.statusChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${toggle.label}${on ? ', selected' : ''}`}
                >
                  <Text style={[styles.statusLabel, on && styles.statusLabelActive]}>
                    {toggle.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Sticky CTA with the live count. */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <Pressable
            onPress={handleApply}
            disabled={shownCount === 0}
            style={[styles.cta, shownCount === 0 && styles.ctaDisabled]}
            accessibilityRole="button"
            accessibilityLabel={ctaLabel(shownCount)}
            accessibilityState={{ disabled: shownCount === 0 }}
          >
            <Text style={styles.ctaLabel}>{ctaLabel(shownCount)}</Text>
          </Pressable>
          {active > 0 ? (
            <Text style={styles.activeNote}>
              {active} {active === 1 ? 'filter' : 'filters'} selected
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.screenX,
    paddingBottom: space.lg,
  },
  headerButton: { minWidth: space.tapMin, minHeight: space.tapMin, justifyContent: 'center' },
  headerGlyph: { fontSize: 28, color: color.text, lineHeight: 30 },
  title: {
    fontSize: type.title3.fontSize,
    lineHeight: type.title3.lineHeight,
    fontWeight: type.title3.fontWeight,
    color: color.text,
  },
  reset: {
    textAlign: 'right',
    fontSize: type.body.fontSize,
    color: color.text,
  },
  resetDisabled: { color: color.textTertiary },

  content: { paddingHorizontal: space.screenX, paddingBottom: space.giant },
  groupLabel: {
    marginBottom: space.sm,
    fontSize: type.micro.fontSize,
    lineHeight: type.micro.lineHeight,
    fontWeight: type.micro.fontWeight,
    letterSpacing: type.micro.letterSpacing,
    color: color.textSecondary,
    textTransform: 'uppercase',
  },
  statusWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  statusChip: {
    minHeight: 36,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  statusChipActive: { backgroundColor: color.accentSoft, borderColor: color.accentSoft },
  statusLabel: { fontSize: type.subhead.fontSize, color: color.textSecondary },
  statusLabelActive: { color: color.text, fontWeight: type.bodyStrong.fontWeight },

  footer: {
    paddingHorizontal: space.screenX,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: color.divider,
    backgroundColor: color.bg,
  },
  cta: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: color.inverseBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.45 },
  ctaLabel: {
    color: color.inverseText,
    fontSize: type.bodyStrong.fontSize,
    fontWeight: type.bodyStrong.fontWeight,
  },
  activeNote: {
    marginTop: space.sm,
    textAlign: 'center',
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },
});
