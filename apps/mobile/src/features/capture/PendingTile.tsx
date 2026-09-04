import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { color, radius, space, type } from '@mira/ui';
import type { CaptureEntry } from './queue-core';
import { captureFileUri } from './preprocess';

/**
 * A capture that is in the closet but not yet on the server (task 2.6).
 *
 * The photograph is shown from the LOCAL file, which is why the exit criterion
 * "capture → visible in closet < 1 s" is achievable at all: nothing here waits
 * on a network round trip. The tile is the user's receipt that their photo
 * exists, whatever the connection is doing.
 *
 * It deliberately looks like a garment tile rather than a progress row. A queue
 * rendered as infrastructure — spinners, percentages, retry buttons — turns the
 * closet into an upload manager, which is precisely what Mira is not.
 */
export type PendingTileProps = {
  entry: CaptureEntry;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
};

export function PendingTile({ entry, onRetry, onDiscard }: PendingTileProps) {
  const failed = entry.status === 'failed';

  // Failure is the only state that needs words: everything else is simply the
  // photo, arriving.
  const label = failed
    ? "This photo didn't upload. Double tap to try again."
    : 'New photo, still being added to your closet';

  return (
    <Pressable
      style={styles.root}
      testID="pending-capture"
      onPress={failed ? () => onRetry(entry.id) : undefined}
      accessibilityRole={failed ? 'button' : 'image'}
      accessibilityLabel={label}
      accessibilityActions={
        failed ? [{ name: 'discard', label: 'Remove this photo' }] : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'discard') onDiscard(entry.id);
      }}
    >
      <View style={styles.imageWrap}>
        <Image
          style={styles.image}
          source={{ uri: captureFileUri(entry.fileName) }}
          contentFit="cover"
        />
        {/* A soft veil, not a spinner: the photo is the reassurance. */}
        <View style={[styles.veil, failed && styles.veilFailed]} />
      </View>

      <Text style={styles.caption} numberOfLines={1}>
        {failed ? 'Tap to retry' : 'Adding…'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  imageWrap: {
    aspectRatio: 0.78,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.surfaceSunken,
  },
  image: { width: '100%', height: '100%' },
  veil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.pendingVeil,
  },
  veilFailed: { backgroundColor: color.pendingVeilFailed },
  caption: {
    marginTop: space.sm,
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },
});
