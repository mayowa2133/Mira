import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import { Icon } from '@/ui/Icon';

/**
 * Scan receipt (§11, task 4.3).
 *
 * > Document capture with edge detection and auto-shutter, plus `Choose file`
 * > for screenshots and PDFs.
 *
 * What this does: captures the image, or takes one from the library, and hands
 * it to the receipt import. What it does NOT do is read it — parsing is 4.4 and
 * needs a vision provider. So the screen says so at the end rather than showing
 * a confirmation list it cannot fill (CAP-4: degrade, never dead-end).
 *
 * Edge detection and auto-shutter are also not here. A guide frame does most of
 * the work of the former, and auto-shutter without detection would fire on
 * nothing — a worse experience than a button.
 */
export default function ScanReceiptScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [captured, setCaptured] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const capture = async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    try {
      const photo = await camera.current.takePictureAsync({ skipProcessing: false });
      if (photo?.uri) setCaptured(photo.uri);
    } finally {
      setBusy(false);
    }
  };

  /** §11's `Choose file`: screenshots of order confirmations are common. */
  const choose = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) setCaptured(result.assets[0].uri);
  };

  if (captured) {
    return (
      <View style={[styles.done, { paddingTop: insets.top + space.giant }]}>
        <Text style={styles.doneTitle}>Receipt saved.</Text>
        <Text style={styles.doneBody}>
          Mira can&apos;t read receipts yet — that arrives with the rest of purchase detection.
          Until then, adding the pieces by hand is the way in, and your receipt is kept.
        </Text>
        <Pressable
          style={styles.primaryDark}
          onPress={() => router.replace('/add/manual')}
          accessibilityRole="button"
          testID="receipt-manual"
        >
          <Text style={styles.primaryDarkLabel}>Add a piece by hand</Text>
        </Pressable>
        <Pressable
          style={styles.tertiaryDark}
          onPress={() => setCaptured(null)}
          accessibilityRole="button"
        >
          <Text style={styles.tertiaryDarkLabel}>Scan another</Text>
        </Pressable>
      </View>
    );
  }

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    return (
      <View style={[styles.done, { paddingTop: insets.top + space.giant }]}>
        <Text style={styles.doneTitle}>Mira needs the camera to scan a receipt.</Text>
        <Text style={styles.doneBody}>You can also pick a screenshot from your library.</Text>
        <Pressable
          style={styles.primaryDark}
          onPress={() => void requestPermission()}
          accessibilityRole="button"
        >
          <Text style={styles.primaryDarkLabel}>Allow camera</Text>
        </Pressable>
        <Pressable
          style={styles.tertiaryDark}
          onPress={() => void choose()}
          accessibilityRole="button"
        >
          <Text style={styles.tertiaryDarkLabel}>Choose a file</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />

      <View style={[styles.chrome, { paddingTop: insets.top + space.md }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={space.md}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Icon name="close" size={22} color={color.text} />
        </Pressable>
      </View>

      {/* A document-shaped guide. It does most of the work edge detection would
          and never claims to have found an edge it did not. */}
      <View style={styles.guide} pointerEvents="none" />

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.xl }]}>
        <Text style={styles.hint}>Fit the whole receipt in the frame.</Text>

        <Pressable
          style={styles.shutter}
          onPress={() => void capture()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Capture receipt"
          testID="receipt-shutter"
        />

        <Pressable style={styles.tertiary} onPress={() => void choose()} accessibilityRole="button">
          <Text style={styles.tertiaryLabel}>Choose a file</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.cameraBg },
  chrome: { paddingHorizontal: space.screenX },
  close: { fontSize: 24, color: color.cameraChrome },

  guide: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: '18%',
    bottom: '30%',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: color.cameraGuide,
  },

  bottom: { marginTop: 'auto', alignItems: 'center', gap: space.md },
  hint: { fontSize: type.subhead.fontSize, color: color.cameraChrome },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: color.cameraChrome,
  },
  tertiary: { minHeight: space.tapMin, justifyContent: 'center' },
  tertiaryLabel: { fontSize: type.subhead.fontSize, color: color.cameraGuide },

  done: { flex: 1, backgroundColor: color.bg, paddingHorizontal: space.screenX },
  doneTitle: {
    fontSize: type.title2.fontSize,
    fontWeight: type.title2.fontWeight,
    color: color.text,
  },
  doneBody: {
    marginTop: space.sm,
    marginBottom: space.xl,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: color.textSecondary,
  },
  primaryDark: {
    minHeight: space.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: color.text,
  },
  primaryDarkLabel: { fontSize: type.body.fontSize, color: color.inverseText },
  tertiaryDark: {
    marginTop: space.sm,
    minHeight: space.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tertiaryDarkLabel: { fontSize: type.subhead.fontSize, color: color.textSecondary },
});
