import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';

/**
 * Add to your closet (`docs/02-design/screen-specs.md` §18).
 *
 * The camera method gets the strongest hierarchy; manual entry is always last
 * (`docs/01-product/feature-specs.md` — F-01, and the Add item menu wireframe).
 *
 * Camera and photo library work as of Phase 2; tag and receipt land in Phase
 * 4, email in Phase 8. Options that cannot work yet say so rather than
 * dead-ending.
 */
/**
 * The other ways in.
 *
 * `to` is set once a route exists; `phase` names what is still coming. A row
 * that opens nothing and explains nothing reads as broken (CAP-4).
 */
const OPTIONS: { icon: string; label: string; phase: string | null; to: string | null }[] = [
  { icon: '🏷', label: 'Scan a tag', phase: null, to: '/add/tag' },
  { icon: '🧾', label: 'Scan a receipt', phase: null, to: '/add/receipt' },
  // The review screen exists; what fills it does not, and it says so.
  { icon: '✉️', label: 'Review purchases', phase: null, to: '/purchases' },
  { icon: '🔗', label: 'Paste product link', phase: 'Phase 3', to: null },
];

export default function AddScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title} accessibilityRole="header">
        Add to your closet
      </Text>

      <Pressable
        style={styles.primary}
        onPress={() => router.push('/add/scan')}
        accessibilityRole="button"
        accessibilityLabel="Scan an item. Photograph something you already own."
      >
        <Text style={styles.primaryIcon}>📸</Text>
        <Text style={styles.primaryLabel}>Scan an item</Text>
        <Text style={styles.primaryHint}>Photograph something you already own</Text>
      </Pressable>

      {/* The library route is the same screen: it opens the picker directly,
          so "choose a photo" never means "first grant camera access". */}
      <Pressable
        style={styles.row}
        onPress={() => router.push('/add/scan?source=library')}
        accessibilityRole="button"
        accessibilityLabel="Choose a photo"
      >
        <Text style={styles.rowIcon}>🖼</Text>
        <Text style={styles.rowLabel}>Choose a photo</Text>
        <Text style={styles.rowChevron}>›</Text>
      </Pressable>

      {OPTIONS.map((option) => (
        <Pressable
          key={option.label}
          style={styles.row}
          disabled={!option.to}
          onPress={() => option.to && router.push(option.to as never)}
          accessibilityRole="button"
          accessibilityLabel={option.phase ? `${option.label}, ${option.phase}` : option.label}
          testID={`add-${option.label.split(' ')[0]?.toLowerCase()}`}
        >
          <Text style={styles.rowIcon}>{option.icon}</Text>
          <Text style={[styles.rowLabel, !option.to && styles.rowLabelPending]}>
            {option.label}
          </Text>
          <Text style={styles.rowPending}>{option.phase ?? '›'}</Text>
        </Pressable>
      ))}

      {/* Manual entry is always LAST in the hierarchy: every option above it
          exists to avoid it (docs/02-design/screen-specs.md §18). */}
      <Pressable
        style={styles.row}
        onPress={() => router.push('/add/manual')}
        accessibilityRole="button"
        accessibilityLabel="Add manually"
      >
        <Text style={styles.rowIcon}>✎</Text>
        <Text style={styles.rowLabel}>Add manually</Text>
        <Text style={styles.rowChevron}>›</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.screenX, paddingBottom: space.giant },
  title: {
    paddingTop: space.lg,
    paddingBottom: space.xxl,
    fontSize: type.title1.fontSize,
    lineHeight: type.title1.lineHeight,
    fontWeight: type.title1.fontWeight,
    color: color.text,
  },
  primary: {
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    marginBottom: space.xl,
  },
  primaryIcon: { fontSize: 28 },
  primaryLabel: {
    marginTop: space.md,
    fontSize: type.title3.fontSize,
    fontWeight: type.title3.fontWeight,
    color: color.text,
  },
  primaryHint: {
    marginTop: space.xs,
    fontSize: type.subhead.fontSize,
    color: color.textSecondary,
  },
  pending: { marginTop: space.md, fontSize: type.caption.fontSize, color: color.textTertiary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: space.tapMin + space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  rowIcon: { width: space.xxxl, fontSize: 18 },
  rowLabel: { flex: 1, fontSize: type.body.fontSize, color: color.text },
  rowLabelPending: { color: color.textSecondary },
  rowPending: { fontSize: type.caption.fontSize, color: color.textTertiary },
  rowChevron: { fontSize: 20, color: color.textSecondary },
});
