import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';

/**
 * Add to your closet (`docs/02-design/screen-specs.md` §18).
 *
 * The camera method gets the strongest hierarchy; manual entry is always last
 * (`docs/01-product/feature-specs.md` — F-01, and the Add item menu wireframe).
 *
 * Phase 1 renders the menu. The flows behind it land in their own phases:
 * camera in Phase 2, tag and receipt in Phase 4, email in Phase 8. Options that
 * cannot work yet say so rather than dead-ending.
 */
const OPTIONS = [
  { icon: '🏷', label: 'Scan a tag', phase: 'Phase 4' },
  { icon: '🧾', label: 'Scan a receipt', phase: 'Phase 4' },
  { icon: '✉️', label: 'Find online purchases', phase: 'Phase 8' },
  { icon: '🖼', label: 'Choose a photo', phase: 'Phase 2' },
  { icon: '🔗', label: 'Paste product link', phase: 'Phase 3' },
  { icon: '✎', label: 'Add manually', phase: 'Next' },
];

export default function AddScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title} accessibilityRole="header">
        Add to your closet
      </Text>

      <View style={styles.primary}>
        <Text style={styles.primaryIcon}>📸</Text>
        <Text style={styles.primaryLabel}>Scan an item</Text>
        <Text style={styles.primaryHint}>Photograph something you already own</Text>
        <Text style={styles.pending}>Camera capture arrives in Phase 2</Text>
      </View>

      {OPTIONS.map((option) => (
        <View key={option.label} style={styles.row} accessibilityRole="button">
          <Text style={styles.rowIcon}>{option.icon}</Text>
          <Text style={styles.rowLabel}>{option.label}</Text>
          <Text style={styles.rowPending}>{option.phase}</Text>
        </View>
      ))}
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
  rowPending: { fontSize: type.caption.fontSize, color: color.textTertiary },
});
