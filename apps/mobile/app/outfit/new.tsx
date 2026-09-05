import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/ui/Text';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import { Icon } from '@/ui/Icon';
import { SLOT_ORDER, conflictsFor, missingSlots, type OutfitSlot } from '@mira/taxonomy';
import { ClosetGridSkeleton, ClosetState } from '@/features/closet/ClosetGrid';
import { imageSrc, useGarments } from '@/features/closet/queries';
import { useCreateOutfit } from '@/features/outfits/queries';
import { useSnackbar } from '@/ui/Snackbar';

/**
 * Outfit builder (task 6.2) — a slot-filtered closet.
 *
 * Picking a slot filters the closet to what could go there, which is the whole
 * point: choosing shoes from a list of 228 garments is a search problem the
 * user should not have.
 *
 * Slot conflicts are shown as a NOTE, never a block. taxonomy §14 says the user
 * may override the dress/separates rule — layering a top over a dress is
 * legitimate — so the builder mentions it and gets out of the way.
 */
type Picked = { garmentId: string; slot: OutfitSlot; label: string; image: string | null };

/** Which garment categories can fill each slot. */
const SLOT_CATEGORIES: Record<OutfitSlot, string[]> = {
  top: ['tops'],
  bottom: ['bottoms'],
  dress: ['dresses', 'sets'],
  layer: ['outerwear'],
  shoes: ['shoes'],
  bag: ['bags'],
  accessory: ['accessories'],
};

export default function OutfitBuilderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useSnackbar();

  const [slot, setSlot] = useState<OutfitSlot>('top');
  const [picked, setPicked] = useState<Picked[]>([]);
  const [name, setName] = useState('');

  const create = useCreateOutfit();

  const garments = useGarments({ category: SLOT_CATEGORIES[slot] });
  const items = useMemo(
    () => garments.data?.pages.flatMap((page) => page.data) ?? [],
    [garments.data],
  );

  const slots = useMemo(() => picked.map((entry) => entry.slot), [picked]);
  const conflicts = useMemo(() => conflictsFor(slots, slot), [slots, slot]);
  const missing = useMemo(() => missingSlots(slots), [slots]);

  const toggle = useCallback(
    (garmentId: string, label: string, image: string | null) => {
      setPicked((current) => {
        const existing = current.find((entry) => entry.garmentId === garmentId);
        if (existing) return current.filter((entry) => entry.garmentId !== garmentId);
        return [...current, { garmentId, slot, label, image }];
      });
    },
    [slot],
  );

  const save = useCallback(() => {
    if (picked.length === 0) return;

    create.mutate(
      {
        name: name.trim().length > 0 ? name.trim() : null,
        occasion: null,
        items: picked.map((entry) => ({ garment_id: entry.garmentId, slot: entry.slot })),
      },
      {
        onSuccess: (outfit) => {
          show({ message: 'Look saved.' });
          router.replace(`/look/${outfit.id}`);
        },
        onError: () => show({ message: "We couldn't save that look.", tone: 'error' }),
      },
    );
  }, [create, name, picked, router, show]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.md}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.headerGlyph}>×</Text>
        </Pressable>

        <Text style={styles.title} accessibilityRole="header">
          Build a look
        </Text>

        <View style={styles.headerButton} />
      </View>

      <TextInput
        style={styles.nameInput}
        value={name}
        onChangeText={setName}
        placeholder="Name this look (optional)"
        placeholderTextColor={color.textTertiary}
        accessibilityLabel="Look name"
      />

      {/* What is already in the look. */}
      {picked.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickedRow}>
          {picked.map((entry) => (
            <Pressable
              key={entry.garmentId}
              style={styles.pickedChip}
              onPress={() => toggle(entry.garmentId, entry.label, entry.image)}
              accessibilityRole="button"
              accessibilityLabel={`${entry.label}, in this look. Double tap to remove.`}
            >
              {entry.image ? (
                <Image
                  style={styles.pickedImage}
                  source={{ uri: entry.image }}
                  accessible={false}
                />
              ) : (
                <View style={[styles.pickedImage, styles.pickedEmpty]} />
              )}
              <Icon name="close" size={14} color={color.textSecondary} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.slotRow}
      >
        {SLOT_ORDER.map((entry) => {
          const active = entry === slot;
          const filled = slots.includes(entry);
          return (
            <Pressable
              key={entry}
              onPress={() => setSlot(entry)}
              style={[styles.slotChip, active && styles.slotChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${entry.replace(/_/g, ' ')}${filled ? ', filled' : ''}${active ? ', selected' : ''}`}
            >
              <Text style={[styles.slotLabel, active && styles.slotLabelActive]}>
                {entry.replace(/_/g, ' ')}
                {filled ? ' ✓' : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* A note, not a block. */}
      {conflicts.length > 0 ? (
        <Text style={styles.note} accessibilityLiveRegion="polite">
          {conflicts[0]?.kind === 'dress_with_separates'
            ? 'You already have a dress in this look — adding a top is fine if you are layering.'
            : 'That slot already has a piece. Adding another is fine.'}
        </Text>
      ) : null}

      <ScrollView contentContainerStyle={styles.grid}>
        {garments.isPending ? (
          <ClosetGridSkeleton count={4} />
        ) : items.length === 0 ? (
          <ClosetState
            message={`Nothing in your closet for ${slot.replace(/_/g, ' ')} yet.`}
            actionLabel="Add a piece"
            onAction={() => router.push('/add')}
          />
        ) : (
          <View style={styles.gridInner}>
            {items.map((garment) => {
              const image = imageSrc(garment.canonical_image, 'thumb');
              const label = [garment.brand?.name ?? garment.brand_raw, garment.name]
                .filter(Boolean)
                .join(' ');
              const chosen = picked.some((entry) => entry.garmentId === garment.id);

              return (
                <Pressable
                  key={garment.id}
                  style={styles.cell}
                  onPress={() => toggle(garment.id, label || 'Piece', image)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: chosen }}
                  accessibilityLabel={`${label || 'Piece'}${chosen ? ', in this look' : ''}`}
                >
                  <View style={[styles.cellImageWrap, chosen && styles.cellChosen]}>
                    {image ? (
                      <Image
                        style={styles.cellImage}
                        source={{ uri: image }}
                        contentFit="cover"
                        accessible={false}
                      />
                    ) : (
                      <View style={styles.cellImage} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        {/* Says what is missing without refusing to save — a half-built look is
            a start, not a mistake. */}
        {missing.length > 0 && picked.length > 0 ? (
          <Text style={styles.missing}>Add a {missing.join(' and a ')} to finish the look.</Text>
        ) : null}

        <Pressable
          style={[styles.cta, picked.length === 0 && styles.ctaDisabled]}
          onPress={save}
          disabled={picked.length === 0 || create.isPending}
          accessibilityRole="button"
          accessibilityLabel={
            picked.length === 0
              ? 'Pick a piece to save a look'
              : `Save look with ${picked.length} ${picked.length === 1 ? 'piece' : 'pieces'}`
          }
          accessibilityState={{ disabled: picked.length === 0 }}
        >
          <Text style={styles.ctaLabel}>
            {create.isPending
              ? 'Saving…'
              : picked.length === 0
                ? 'Pick a piece'
                : `Save look · ${picked.length}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.screenX,
    paddingBottom: space.sm,
  },
  headerButton: { minWidth: space.tapMin, minHeight: space.tapMin, justifyContent: 'center' },
  headerGlyph: { fontSize: 28, color: color.text },
  title: { fontSize: type.title3.fontSize, fontWeight: type.title3.fontWeight, color: color.text },

  nameInput: {
    marginHorizontal: space.screenX,
    marginBottom: space.md,
    minHeight: space.tapMin,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    fontSize: type.body.fontSize,
    color: color.text,
  },

  pickedRow: { maxHeight: 92, paddingHorizontal: space.screenX, marginBottom: space.sm },
  pickedChip: { marginRight: space.sm },
  pickedImage: {
    width: 60,
    height: 76,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceSunken,
  },
  pickedEmpty: { backgroundColor: color.surfaceSunken },
  pickedRemove: {
    position: 'absolute',
    top: 2,
    right: 4,
    fontSize: type.caption.fontSize,
    color: color.inverseText,
  },

  slotRow: { paddingHorizontal: space.screenX, gap: space.sm, paddingBottom: space.sm },
  slotChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
  },
  slotChipActive: { backgroundColor: color.accent, borderColor: color.accent },
  slotLabel: { fontSize: type.subhead.fontSize, color: color.textSecondary },
  slotLabelActive: { color: color.inverseText },

  note: {
    paddingHorizontal: space.screenX,
    paddingBottom: space.sm,
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },

  grid: { paddingHorizontal: space.screenX, paddingBottom: space.giant * 2 },
  gridInner: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.xs },
  cell: { width: '33.33%', paddingHorizontal: space.xs, paddingBottom: space.md },
  cellImageWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cellChosen: { borderColor: color.accent },
  cellImage: { width: '100%', aspectRatio: 0.8, backgroundColor: color.surfaceSunken },

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
  missing: {
    marginBottom: space.sm,
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },
  cta: {
    minHeight: space.tapMin,
    borderRadius: radius.full,
    backgroundColor: color.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: color.textTertiary },
  ctaLabel: { fontSize: type.body.fontSize, color: color.inverseText },
});
