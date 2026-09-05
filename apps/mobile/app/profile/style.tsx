import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/ui/Text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, STYLE_TAGS } from '@mira/taxonomy';
import { color, space, type } from '@mira/ui';
import { ChipMultiSelect } from '@/ui/Fields';
import { ClosetGridSkeleton, ClosetState } from '@/features/closet/ClosetGrid';
import { describeLoadFailure } from '@/features/closet/load-failure';
import {
  EMPTY_PREFERENCES,
  toggle,
  useSaveStylePreferences,
  useStylePreferences,
  type StylePreferences,
} from '@/features/profile/preferences';

const titleCase = (value: string) =>
  value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const options = (values: readonly string[]) =>
  values.map((value) => ({ value, label: titleCase(value) }));

/**
 * Style preferences (task 11.1, §28 → Style preferences).
 *
 * Four lists, and the pairing is the point: what you like and what you would
 * rather not see. Choosing something on one side removes it from the other, so
 * the screen cannot express a contradiction the server would refuse.
 *
 * Nothing reads these yet — the stylist is Phase 7. That is worth saying on the
 * screen rather than letting someone set preferences and wonder why nothing
 * changed.
 */
export default function StylePreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const loaded = useStylePreferences();
  const save = useSaveStylePreferences();
  const [draft, setDraft] = useState<StylePreferences>(EMPTY_PREFERENCES);

  useEffect(() => {
    if (loaded.data) setDraft(loaded.data);
  }, [loaded.data]);

  const failure = describeLoadFailure(loaded.error, {
    message: "We couldn't load your preferences.",
  });

  const change = (field: keyof StylePreferences) => (value: string) =>
    setDraft((current) => toggle(current, field, value));

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
    >
      <Pressable onPress={() => router.back()} hitSlop={space.md} accessibilityLabel="Back">
        <Text style={styles.back}>‹</Text>
      </Pressable>
      <Text style={styles.title} accessibilityRole="header">
        Style preferences
      </Text>
      <Text style={styles.subtitle}>
        Mira uses these when it suggests outfits. Suggestions arrive in a later release.
      </Text>

      {loaded.isPending ? (
        <ClosetGridSkeleton count={2} />
      ) : failure ? (
        <ClosetState
          message={failure.message}
          hint={failure.hint}
          actionLabel={failure.actionLabel}
          onAction={() => void loaded.refetch()}
        />
      ) : (
        <>
          <ChipMultiSelect
            label="Styles you like"
            options={options(STYLE_TAGS)}
            values={draft.preferred_styles}
            onToggle={change('preferred_styles')}
          />
          <ChipMultiSelect
            label="Styles you'd rather not"
            options={options(STYLE_TAGS)}
            values={draft.avoided_styles}
            onToggle={change('avoided_styles')}
          />
          <ChipMultiSelect
            label="Colours you like"
            options={options(COLORS)}
            values={draft.preferred_colors}
            onToggle={change('preferred_colors')}
          />
          <ChipMultiSelect
            label="Colours you'd rather not"
            options={options(COLORS)}
            values={draft.avoided_colors}
            onToggle={change('avoided_colors')}
          />

          <Pressable
            style={styles.save}
            disabled={save.isPending}
            onPress={() => save.mutate(draft)}
            accessibilityRole="button"
            testID="save-preferences"
          >
            <Text style={styles.saveLabel}>{save.isPending ? 'Saving…' : 'Save'}</Text>
          </Pressable>

          {save.isSuccess ? <Text style={styles.saved}>Saved.</Text> : null}
          {save.error ? (
            <Text style={styles.saved}>
              {describeLoadFailure(save.error, { message: "We couldn't save that." })?.message}
            </Text>
          ) : null}
        </>
      )}
    </ScrollView>
  );
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
  subtitle: {
    marginTop: space.sm,
    marginBottom: space.xl,
    fontSize: type.subhead.fontSize,
    color: color.textSecondary,
  },
  save: {
    marginTop: space.xl,
    minHeight: space.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: color.text,
  },
  saveLabel: { fontSize: type.body.fontSize, color: color.inverseText },
  saved: {
    marginTop: space.md,
    textAlign: 'center',
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },
});
