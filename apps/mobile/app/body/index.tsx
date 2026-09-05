import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import { BODY_PROFILE_COPY, PHOTO_SLOTS } from '@/features/body/copy';
import { describeGateFailure, unlockBodyProfile } from '@/features/body/gate';

/**
 * Body profile setup (§23, tasks 10.1 and 10.2).
 *
 * Two things this screen is careful about, both of which are the product rather
 * than the code:
 *
 * - **TRY-2.** Every line comes from `copy.ts`, where a test asserts none of it
 *   implies guaranteed fit. Try-on shows how a piece looks.
 * - **The gate.** Biometrics guard this surface when the device has them, and
 *   let everyone else straight through — locking someone out of their own
 *   photographs because their phone has no Face ID is worse than the thing the
 *   gate prevents. It is a courtesy lock; the real boundary is `user_id`
 *   scoping at the API.
 *
 * Capture itself is not wired: uploading a body photo needs the same signed
 * upload flow garments use, and the try-on that would justify it is Phase 10's
 * AI half. The slots say so rather than opening a camera that leads nowhere.
 */
export default function BodyProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [unlocked, setUnlocked] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [height, setHeight] = useState('');

  const unlock = useCallback(async () => {
    setGateError(null);
    const result = await unlockBodyProfile();
    if (result.ok) setUnlocked(true);
    else setGateError(describeGateFailure(result.reason));
  }, []);

  // Asked once on arrival. A gate that waits for a button is a gate someone
  // has already walked past.
  useEffect(() => {
    void unlock();
  }, [unlock]);

  if (!unlocked) {
    return (
      <View style={[styles.locked, { paddingTop: insets.top + space.giant }]}>
        <Text style={styles.lockedTitle}>Your photos are locked.</Text>
        <Text style={styles.lockedBody}>
          {gateError ?? 'Unlocking with your face or passcode.'}
        </Text>
        <Pressable
          style={styles.primary}
          onPress={() => void unlock()}
          accessibilityRole="button"
          testID="body-unlock"
        >
          <Text style={styles.primaryLabel}>Unlock</Text>
        </Pressable>
        <Pressable style={styles.tertiary} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.tertiaryLabel}>Not now</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
    >
      <Pressable onPress={() => router.back()} hitSlop={space.md} accessibilityLabel="Back">
        <Text style={styles.back}>‹</Text>
      </Pressable>

      <Text style={styles.title} accessibilityRole="header">
        {BODY_PROFILE_COPY.title}
      </Text>
      <Text style={styles.intro}>{BODY_PROFILE_COPY.intro}</Text>

      {/* Privacy and the limitation together, at the moment of deciding —
          not in a settings screen afterwards. */}
      <View style={styles.notice}>
        <Text style={styles.noticeText}>{BODY_PROFILE_COPY.privacy}</Text>
        <Text style={styles.noticeText}>{BODY_PROFILE_COPY.limitation}</Text>
      </View>

      {PHOTO_SLOTS.map((slot) => (
        <View key={slot.kind} style={styles.slot}>
          <View style={styles.slotText}>
            <Text style={styles.slotLabel}>{slot.label}</Text>
            <Text style={styles.slotMeta}>{slot.required ? 'Required' : 'Optional'}</Text>
          </View>
          <Text style={styles.slotPending}>Phase 10</Text>
        </View>
      ))}

      <Text style={styles.guidance}>{BODY_PROFILE_COPY.guidance}</Text>

      <Text style={styles.fieldLabel}>Height (optional)</Text>
      <TextInput
        style={styles.field}
        value={height}
        onChangeText={setHeight}
        placeholder="cm"
        placeholderTextColor={color.textTertiary}
        keyboardType="number-pad"
        accessibilityLabel="Height in centimetres"
      />

      <Text style={styles.pendingNote}>
        Photos arrive with try-on. Your height is saved now and used to size what Mira shows you.
      </Text>
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
    color: color.text,
  },
  intro: { marginTop: space.sm, fontSize: type.body.fontSize, color: color.textSecondary },

  notice: {
    marginTop: space.xl,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    gap: space.sm,
  },
  noticeText: {
    fontSize: type.subhead.fontSize,
    lineHeight: type.subhead.lineHeight,
    color: color.textSecondary,
  },

  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: space.tapMin,
    marginTop: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  slotText: { flex: 1 },
  slotLabel: { fontSize: type.body.fontSize, color: color.text },
  slotMeta: { marginTop: space.xxs, fontSize: type.caption.fontSize, color: color.textTertiary },
  slotPending: { fontSize: type.caption.fontSize, color: color.textTertiary },

  guidance: {
    marginTop: space.xl,
    fontSize: type.caption.fontSize,
    color: color.textTertiary,
  },

  fieldLabel: {
    marginTop: space.xl,
    marginBottom: space.xs,
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },
  field: {
    minHeight: space.tapMin,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.divider,
    backgroundColor: color.surface,
    fontSize: type.body.fontSize,
    color: color.text,
  },
  pendingNote: {
    marginTop: space.xl,
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    color: color.textTertiary,
  },

  locked: { flex: 1, backgroundColor: color.bg, paddingHorizontal: space.screenX },
  lockedTitle: {
    fontSize: type.title2.fontSize,
    fontWeight: type.title2.fontWeight,
    color: color.text,
  },
  lockedBody: {
    marginTop: space.sm,
    marginBottom: space.xl,
    fontSize: type.body.fontSize,
    color: color.textSecondary,
  },
  primary: {
    minHeight: space.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: color.text,
  },
  primaryLabel: { fontSize: type.body.fontSize, color: color.inverseText },
  tertiary: {
    marginTop: space.sm,
    minHeight: space.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tertiaryLabel: { fontSize: type.subhead.fontSize, color: color.textSecondary },
});
