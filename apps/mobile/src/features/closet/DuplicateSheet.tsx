import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import {
  CHOICES,
  consequenceOf,
  describeGarment,
  headlineFor,
  type DuplicateCandidate,
  type DuplicateRelation,
} from './duplicate-sheet';

/**
 * The duplicate resolution sheet (`docs/06-ai/duplicate-detection.md` §4).
 *
 * > Both garments are shown as images, because that is how the user will
 * > actually decide.
 *
 * So the two pieces are the screen, and the text is caption to them. The one
 * line of explanation is the signals that fired, in words — never a score.
 *
 * There is no primary action. All three answers are equally legitimate: §1 is
 * explicit that owning two identical black bodysuits is normal, and a sheet
 * that visually recommends merging would push people towards the one answer
 * that cannot be undone afterwards.
 */
export type DuplicateSheetProps = {
  visible: boolean;
  candidate: DuplicateCandidate | null;
  /** How the piece being added reads, for the comparison line. */
  incoming: { label: string; imageUri: string | null };
  busy?: boolean;
  onResolve: (relation: DuplicateRelation) => void;
  onCancel: () => void;
};

export function DuplicateSheet({
  visible,
  candidate,
  incoming,
  busy = false,
  onResolve,
  onCancel,
}: DuplicateSheetProps) {
  const insets = useSafeAreaInsets();
  if (!candidate) return null;

  const existing = candidate.existing_garment;
  const existingImage =
    existing.canonical_image?.thumb_url ?? existing.canonical_image?.url ?? null;

  // §4 shows both pieces as images "because that is how the user will actually
  // decide". When NEITHER has one — two manually added garments, which is the
  // case this sheet sees most — that becomes two large grey rectangles saying
  // nothing, and it pushes the names and the answers off the screen. Same
  // mistake as the saved-looks collage. So imagery appears when there is any to
  // show, and the names lead when there is not.
  const hasImagery = existingImage !== null || incoming.imageUri !== null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={[styles.root, { paddingTop: insets.top + space.lg }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.headline} accessibilityRole="header">
            {headlineFor(candidate.band)}
          </Text>
          <Text style={styles.summary}>{candidate.summary}</Text>

          <View style={styles.pair}>
            <Piece
              caption="In your closet"
              label={describeGarment(existing)}
              imageUri={existingImage}
              showImage={hasImagery}
            />
            <Piece
              caption="Adding now"
              label={incoming.label}
              imageUri={incoming.imageUri}
              showImage={hasImagery}
            />
          </View>

          <View style={styles.choices}>
            {CHOICES.map((choice) => (
              <Pressable
                key={choice.relation}
                style={styles.choice}
                disabled={busy}
                onPress={() => onResolve(choice.relation)}
                accessibilityRole="button"
                testID={`duplicate-${choice.relation}`}
                // What happens is part of the choice, not a surprise after it.
                accessibilityHint={consequenceOf(choice.relation)}
              >
                <Text style={styles.choiceLabel}>{choice.label}</Text>
                <Text style={styles.choiceHint}>{consequenceOf(choice.relation)}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={styles.cancel}
            onPress={onCancel}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Not now"
          >
            <Text style={styles.cancelLabel}>Not now</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Piece({
  caption,
  label,
  imageUri,
  showImage,
}: {
  caption: string;
  label: string;
  imageUri: string | null;
  showImage: boolean;
}) {
  return (
    <View style={styles.piece} accessible accessibilityLabel={`${caption}: ${label}`}>
      {showImage ? (
        imageUri ? (
          <Image
            style={styles.pieceImage}
            source={{ uri: imageUri }}
            contentFit="cover"
            transition={140}
            accessible={false}
          />
        ) : (
          // One piece photographed and the other not is worth seeing: the gap
          // is information, not an empty slot.
          <View style={styles.pieceImage} />
        )
      ) : null}
      <Text style={[styles.pieceCaption, !showImage && styles.pieceCaptionBare]}>{caption}</Text>
      <Text style={styles.pieceLabel} numberOfLines={3}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.screenX, paddingBottom: space.giant },

  headline: {
    fontSize: type.title2.fontSize,
    lineHeight: type.title2.lineHeight,
    fontWeight: type.title2.fontWeight,
    color: color.text,
  },
  summary: { marginTop: space.sm, fontSize: type.subhead.fontSize, color: color.textSecondary },

  pair: { flexDirection: 'row', gap: space.md, marginTop: space.xl },
  piece: { flex: 1 },
  pieceImage: {
    width: '100%',
    aspectRatio: 0.78,
    borderRadius: radius.md,
    backgroundColor: color.surfaceSunken,
  },
  pieceCaptionBare: { marginTop: 0 },
  pieceCaption: {
    marginTop: space.sm,
    fontSize: type.caption.fontSize,
    color: color.textTertiary,
  },
  pieceLabel: { marginTop: space.xxs, fontSize: type.subhead.fontSize, color: color.text },

  choices: { marginTop: space.xxl, gap: space.sm },
  choice: {
    minHeight: space.tapMin,
    justifyContent: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
  },
  choiceLabel: { fontSize: type.body.fontSize, color: color.text },
  choiceHint: { marginTop: space.xxs, fontSize: type.caption.fontSize, color: color.textSecondary },

  cancel: { marginTop: space.xl, minHeight: space.tapMin, justifyContent: 'center' },
  cancelLabel: {
    textAlign: 'center',
    fontSize: type.subhead.fontSize,
    color: color.textSecondary,
  },
});
