import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/ui/Text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import { Icon, type IconName } from '@/ui/Icon';

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
 * `to` is set once a route exists; `status` says what is still coming, in words
 * a user can act on. A row that opens nothing and explains nothing reads as
 * broken (CAP-4).
 */
const OPTIONS: {
  icon: IconName;
  label: string;
  status: string | null;
  to: string | null;
}[] = [
  { icon: 'tag', label: 'Scan a tag', status: null, to: '/add/tag' },
  { icon: 'receipt', label: 'Scan a receipt', status: null, to: '/add/receipt' },
  // The review screen exists; what fills it does not, and it says so.
  { icon: 'mail', label: 'Review purchases', status: null, to: '/purchases' },
  { icon: 'link', label: 'Paste product link', status: 'Coming soon', to: null },
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
        <View style={styles.primaryIcon}>
          <Icon name="camera" size={28} color={color.text} />
        </View>
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
        <View style={styles.rowIcon}>
          <Icon name="image" size={22} color={color.text} />
        </View>
        <Text style={styles.rowLabel}>Choose a photo</Text>
        <Icon name="chevronRight" size={18} color={color.textTertiary} />
      </Pressable>

      {OPTIONS.map((option) => (
        <Pressable
          key={option.label}
          style={styles.row}
          disabled={!option.to}
          onPress={() => option.to && router.push(option.to as never)}
          accessibilityRole="button"
          accessibilityLabel={option.status ? `${option.label}, ${option.status}` : option.label}
          testID={`add-${option.label.split(' ')[0]?.toLowerCase()}`}
        >
          <View style={styles.rowIcon}>
            <Icon name={option.icon} size={22} color={option.to ? color.text : color.textTertiary} />
          </View>
          <Text style={[styles.rowLabel, !option.to && styles.rowLabelPending]}>
            {option.label}
          </Text>
          {option.status ? (
            <Text style={styles.rowPending}>{option.status}</Text>
          ) : (
            <Icon name="chevronRight" size={18} color={color.textTertiary} />
          )}
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
        <View style={styles.rowIcon}>
          <Icon name="pencil" size={22} color={color.text} />
        </View>
        <Text style={styles.rowLabel}>Add manually</Text>
        <Icon name="chevronRight" size={18} color={color.textTertiary} />
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
  primaryIcon: { marginBottom: space.xs },
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
  rowIcon: { width: space.xxxl },
  rowLabel: { flex: 1, fontSize: type.body.fontSize, color: color.text },
  rowLabelPending: { color: color.textSecondary },
  rowPending: { fontSize: type.caption.fontSize, color: color.textTertiary },
});
