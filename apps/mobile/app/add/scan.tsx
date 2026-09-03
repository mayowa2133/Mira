import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import { prepareCapture } from '@/features/capture/preprocess';
import { enqueueCapture } from '@/features/capture/queue';

/**
 * Scan closet — garment camera (`docs/02-design/screen-specs.md` §9).
 *
 * The spec is a list of what is NOT here: no nav bar, no tab bar, no filters,
 * no flash clutter. Only a close control, a silhouette guide, one hint, one
 * shutter, and a way out to the photo library.
 *
 * After capture the photo is written locally and queued, then the screen
 * confirms and returns. It never waits for the network: the garment appears in
 * the closet from the local copy (PERF-3), and the upload happens behind it.
 */
export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Entered from "Choose a photo": open the picker straight away, so that
  // route never asks for camera access it does not need.
  const { source } = useLocalSearchParams<{ source?: string }>();
  const libraryOnly = source === 'library';
  const camera = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const close = useCallback(() => router.back(), [router]);

  /** Hand a photograph to the queue. Never blocks on the network. */
  const accept = useCallback(
    async (uri: string, source: 'camera' | 'photo_library') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const prepared = await prepareCapture(uri, id);
      enqueueCapture({ id, localUri: prepared.localUri, source });

      // §9: "a subtle `Got it.` confirmation before routing to review."
      //
      // Review is the AI item screen, which is Phase 3. Until it exists the
      // right destination is the CLOSET, not `back()` — back returns to the add
      // menu, which leaves the user staring at a list of options immediately
      // after photographing something, with no sight of the thing they added.
      setConfirmation('Got it.');
      setTimeout(() => {
        setConfirmation(null);
        // Close the camera (and the add menu beneath it), then land where the
        // capture actually is.
        router.dismissAll();
        router.replace('/(tabs)/closet');
      }, 700);
    },
    [router],
  );

  const shoot = useCallback(async () => {
    if (busy || !camera.current) return;
    setBusy(true);
    try {
      const photo = await camera.current.takePictureAsync({ skipProcessing: false });
      if (photo?.uri) await accept(photo.uri, 'camera');
    } finally {
      setBusy(false);
    }
  }, [accept, busy]);

  const pickFromLibrary = useCallback(async () => {
    // Permission is requested in context, at the moment of use
    // (`docs/02-design/accessibility.md`, states-and-errors §Permission).
    const granted = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted.granted) {
      // Nothing to fall back to when this route IS the library.
      if (libraryOnly) router.back();
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      // iOS limited selection is a supported mode, not an error: the user gave
      // us some photos and that is a complete answer (states-and-errors §5).
      selectionLimit: 1,
    });

    const asset = picked.assets?.[0];
    if (picked.canceled || !asset) {
      // Cancelling must not strand the user behind a spinner on a screen that
      // shows nothing else.
      if (libraryOnly) router.back();
      return;
    }

    setBusy(true);
    try {
      await accept(asset.uri, 'photo_library');
    } finally {
      setBusy(false);
    }
  }, [accept, libraryOnly, router]);

  const openedPicker = useRef(false);
  useEffect(() => {
    if (!libraryOnly || openedPicker.current) return;
    openedPicker.current = true;
    void pickFromLibrary();
  }, [libraryOnly, pickFromLibrary]);

  // The library route never shows the camera, permitted or not.
  if (libraryOnly) {
    return (
      <View style={[styles.root, styles.permission, { paddingTop: insets.top + space.xl }]}>
        <ActivityIndicator color={color.text} />
      </View>
    );
  }

  // Permission is requested when the screen opens, never at launch.
  if (!permission) {
    return <View style={styles.root} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.permission, { paddingTop: insets.top + space.xl }]}>
        <Text style={styles.permissionTitle} accessibilityRole="header">
          Mira needs the camera to scan your clothes.
        </Text>
        <Text style={styles.permissionBody}>
          Photograph something you own and it appears in your closet — no typing.
        </Text>

        <Pressable
          style={styles.permissionPrimary}
          onPress={() => {
            // Once denied at the OS level, asking again does nothing; the only
            // real route is Settings. Never a dead end (states-and-errors §5).
            if (permission.canAskAgain) void requestPermission();
            else void Linking.openSettings();
          }}
          accessibilityRole="button"
          accessibilityLabel={permission.canAskAgain ? 'Allow camera' : 'Open settings'}
        >
          <Text style={styles.permissionPrimaryLabel}>
            {permission.canAskAgain ? 'Allow camera' : 'Open settings'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.permissionSecondary}
          onPress={() => void pickFromLibrary()}
          accessibilityRole="button"
          accessibilityLabel="Choose a photo instead"
        >
          <Text style={styles.permissionSecondaryLabel}>Choose a photo instead</Text>
        </Pressable>

        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={styles.permissionDismiss}>Not now</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />

      {/* The silhouette guide: where to put the garment, and nothing else. */}
      <View style={styles.guideWrap} pointerEvents="none">
        <View style={styles.guide} />
        <Text style={styles.hint}>Place one item in frame</Text>
      </View>

      <Pressable
        style={[styles.close, { top: insets.top + space.sm }]}
        onPress={close}
        hitSlop={space.md}
        accessibilityRole="button"
        accessibilityLabel="Close camera"
      >
        <Text style={styles.closeGlyph}>×</Text>
      </Pressable>

      <View style={[styles.controls, { paddingBottom: insets.bottom + space.xl }]}>
        <Pressable
          style={styles.shutter}
          onPress={() => void shoot()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          accessibilityState={{ disabled: busy }}
        >
          {busy ? (
            <ActivityIndicator color={color.text} />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </Pressable>

        <Pressable
          onPress={() => void pickFromLibrary()}
          hitSlop={space.md}
          accessibilityRole="button"
          accessibilityLabel="Upload a photo instead"
        >
          <Text style={styles.upload}>Upload instead</Text>
        </Pressable>
      </View>

      {confirmation ? (
        <View style={styles.confirmation} pointerEvents="none" accessibilityLiveRegion="polite">
          <Text style={styles.confirmationLabel}>{confirmation}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.cameraBg },

  // Written out rather than spreading StyleSheet.absoluteFill: whether that
  // is a spreadable object or an opaque id has changed across RN versions,
  // and a silently empty spread here would leave the guide unpositioned.
  guideWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guide: {
    width: '62%',
    aspectRatio: 0.62,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: color.cameraGuide,
  },
  hint: {
    marginTop: space.lg,
    color: color.cameraChrome,
    fontSize: type.body.fontSize,
  },

  close: { position: 'absolute', left: space.lg, width: space.tapMin, height: space.tapMin },
  closeGlyph: { color: color.inverseText, fontSize: 32, lineHeight: 36 },

  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: color.cameraChrome,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: color.inverseText },
  upload: {
    marginTop: space.lg,
    color: color.cameraChrome,
    fontSize: type.body.fontSize,
  },

  confirmation: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: '32%',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    backgroundColor: color.cameraScrim,
  },
  confirmationLabel: { color: color.inverseText, fontSize: type.body.fontSize },

  permission: { paddingHorizontal: space.lg, backgroundColor: color.bg },
  permissionTitle: { ...type.title2, color: color.text, marginBottom: space.sm },
  permissionBody: { ...type.body, color: color.textSecondary, marginBottom: space.xl },
  permissionPrimary: {
    minHeight: space.tapMin,
    borderRadius: radius.full,
    backgroundColor: color.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  permissionPrimaryLabel: { ...type.body, color: color.inverseText },
  permissionSecondary: {
    minHeight: space.tapMin,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  permissionSecondaryLabel: { ...type.body, color: color.text },
  permissionDismiss: { ...type.body, color: color.textSecondary, textAlign: 'center' },
});
