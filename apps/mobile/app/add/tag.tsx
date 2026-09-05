import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import { Icon } from '@/ui/Icon';

/**
 * Scan tag (§10, task 4.1).
 *
 * > Same shell as screen 9, tuned for labels: closer minimum focus, higher
 * > exposure, live barcode detection with a subtle highlight when a code is
 * > found.
 *
 * Barcode detection is on-device and works now. **Reading the tag's text is
 * not** — that is OCR, and OCR is 4.2, which needs a vision provider. So a
 * found barcode is carried into the manual form as an identifier rather than
 * pretending to have understood the garment.
 *
 * CAP-4: this must degrade rather than dead-end. A tag Mira cannot read still
 * gets the user to a form with whatever it did find.
 */
export default function ScanTagScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [found, setFound] = useState<string | null>(null);

  const onBarcode = useCallback((result: BarcodeScanningResult) => {
    // First code wins and scanning stops. A tag held still emits the same
    // code many times a second, and re-rendering on each is both wasteful
    // and makes the highlight flicker.
    setFound((current) => current ?? result.data);
  }, []);

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    // states-and-errors.md: explain what the permission unlocks, offer the
    // route, never a dead end.
    return (
      <View style={[styles.root, styles.permission, { paddingTop: insets.top + space.giant }]}>
        <Text style={styles.permissionTitle}>Mira needs the camera to read a tag.</Text>
        <Text style={styles.permissionBody}>
          Point it at a care label or barcode and Mira fills in what it can.
        </Text>
        <Pressable
          style={styles.primary}
          onPress={() => void requestPermission()}
          accessibilityRole="button"
        >
          <Text style={styles.primaryLabel}>Allow camera</Text>
        </Pressable>
        <Pressable
          style={styles.tertiary}
          onPress={() => router.replace('/add/manual')}
          accessibilityRole="button"
        >
          <Text style={styles.tertiaryLabel}>Type it in instead</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        // Only the symbologies clothing tags actually carry. Scanning every
        // format costs frames and finds QR codes on shop windows.
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
        onBarcodeScanned={found ? undefined : onBarcode}
      />

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

      {/* The subtle highlight §10 asks for: the frame confirms a code was seen
          without covering the tag. */}
      <View style={[styles.reticle, found ? styles.reticleFound : null]} pointerEvents="none" />

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.xl }]}>
        <Text style={styles.hint} accessibilityLiveRegion="polite">
          {found ? 'Barcode found' : 'Point at the tag — brand, size or barcode.'}
        </Text>

        {found ? (
          <Pressable
            style={styles.primary}
            onPress={() =>
              // Carried as an identifier, not as an understanding of the
              // garment. Reading the tag's words is 4.2.
              router.replace({ pathname: '/add/manual', params: { barcode: found } })
            }
            accessibilityRole="button"
            testID="use-barcode"
          >
            <Text style={styles.primaryLabel}>Use this barcode</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={styles.tertiary}
          onPress={() => router.replace('/add/manual')}
          accessibilityRole="button"
          testID="tag-manual"
        >
          <Text style={styles.tertiaryLabel}>
            {found ? 'Enter the rest by hand' : 'Type it in instead'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.cameraBg },
  chrome: { paddingHorizontal: space.screenX },
  close: { fontSize: 24, color: color.cameraChrome },

  reticle: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    top: '34%',
    height: '22%',
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: color.cameraGuide,
  },
  reticleFound: { borderColor: color.cameraChrome, borderWidth: 3 },

  bottom: { marginTop: 'auto', paddingHorizontal: space.screenX, gap: space.sm },
  hint: {
    textAlign: 'center',
    marginBottom: space.md,
    fontSize: type.subhead.fontSize,
    color: color.cameraChrome,
  },

  permission: { paddingHorizontal: space.screenX, backgroundColor: color.bg },
  permissionTitle: {
    fontSize: type.title2.fontSize,
    fontWeight: type.title2.fontWeight,
    color: color.text,
  },
  permissionBody: {
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
    backgroundColor: color.cameraChrome,
  },
  primaryLabel: { fontSize: type.body.fontSize, color: color.text },
  tertiary: { minHeight: space.tapMin, alignItems: 'center', justifyContent: 'center' },
  tertiaryLabel: { fontSize: type.subhead.fontSize, color: color.cameraGuide },
});
