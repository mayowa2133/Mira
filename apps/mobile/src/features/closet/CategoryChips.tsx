import { memo, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { color, radius, space, type } from '@mira/ui';

/**
 * Horizontally scrollable category chips (`docs/02-design/screen-specs.md` §14).
 *
 * The order matches the closet chips in the screen spec, not the taxonomy's
 * storage order: it is a merchandising decision, not a data one.
 */
export const CLOSET_CATEGORIES = [
  { id: null, label: 'All' },
  { id: 'tops', label: 'Tops' },
  { id: 'bottoms', label: 'Bottoms' },
  { id: 'dresses', label: 'Dresses' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'bags', label: 'Bags' },
  { id: 'outerwear', label: 'Outerwear' },
  { id: 'accessories', label: 'Accessories' },
  { id: 'sets', label: 'Sets' },
  { id: 'activewear', label: 'Activewear' },
  { id: 'swimwear', label: 'Swimwear' },
  { id: 'other', label: 'Other' },
] as const;

export type CategoryChipsProps = {
  selected: string | null;
  onSelect: (category: string | null) => void;
};

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      // Selection is carried by state as well as fill, so it is not colour-only
      // (A11Y-4, docs/02-design/accessibility.md §5).
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}${active ? ', selected' : ''}`}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function CategoryChipsComponent({ selected, onSelect }: CategoryChipsProps) {
  const handle = useCallback((id: string | null) => () => onSelect(id), [onSelect]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    >
      {CLOSET_CATEGORIES.map((category) => (
        <Chip
          key={category.id ?? 'all'}
          label={category.label}
          active={selected === category.id}
          onPress={handle(category.id)}
        />
      ))}
    </ScrollView>
  );
}

export const CategoryChips = memo(CategoryChipsComponent);

const styles = StyleSheet.create({
  row: { paddingVertical: space.sm, gap: space.sm },
  chip: {
    minHeight: space.tapMin - space.sm,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  chipActive: { backgroundColor: color.accentSoft, borderColor: color.accentSoft },
  chipLabel: {
    fontSize: type.subhead.fontSize,
    lineHeight: type.subhead.lineHeight,
    color: color.textSecondary,
  },
  chipLabelActive: { color: color.text, fontWeight: type.bodyStrong.fontWeight },
});
