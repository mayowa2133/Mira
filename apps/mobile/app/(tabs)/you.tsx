import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import { Icon } from '@/ui/Icon';
import { PROFILE_ROWS } from '@/features/profile/rows';
import { useMe } from '@/features/identity/queries';
import { describeLoadFailure } from '@/features/closet/load-failure';
import { ClosetState } from '@/features/closet/ClosetGrid';

/**
 * You (`docs/02-design/screen-specs.md` §28).
 *
 * A plain list, deliberately. This is the one screen in Mira that should look
 * like settings, because that is what someone comes here to do — and the rows
 * that do not exist yet say so in words rather than opening nothing.
 */
export default function YouScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useMe();

  const failure = describeLoadFailure(me.error, { message: "We couldn't load your profile." });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
    >
      <Text style={styles.title} accessibilityRole="header">
        You
      </Text>

      {failure ? (
        <ClosetState
          message={failure.message}
          hint={failure.hint}
          actionLabel={failure.actionLabel}
          onAction={() => void me.refetch()}
        />
      ) : (
        <>
          <View style={styles.identity}>
            <View style={styles.avatar} />
            <View style={styles.identityText}>
              <Text style={styles.name}>{me.data?.display_name ?? 'Your closet'}</Text>
              {me.data?.email ? <Text style={styles.email}>{me.data.email}</Text> : null}
            </View>
          </View>

          <View style={styles.rows}>
            {PROFILE_ROWS.map((row, index) => (
              <Pressable
                key={row.key}
                // A divider under the LAST row has nothing beneath it to
                // separate, and the container's radius clips it into a short
                // inset line that reads as a rendering fault.
                style={[styles.row, index === PROFILE_ROWS.length - 1 && styles.rowLast]}
                disabled={!row.to}
                onPress={() => row.to && router.push(row.to as never)}
                accessibilityRole="button"
                accessibilityLabel={row.status ? `${row.label}, ${row.status}` : row.label}
                testID={`profile-${row.key}`}
              >
                <Text style={[styles.rowLabel, !row.to && styles.rowLabelPending]}>
                  {row.label}
                </Text>
                {row.status ? (
                  <Text style={styles.rowMeta}>{row.status}</Text>
                ) : (
                  <Icon name="chevronRight" size={18} color={color.textTertiary} />
                )}
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.screenX, paddingBottom: space.giant },
  title: {
    fontSize: type.display.fontSize,
    lineHeight: type.display.lineHeight,
    fontWeight: type.display.fontWeight,
    letterSpacing: type.display.letterSpacing,
    color: color.text,
    marginBottom: space.xl,
  },

  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xxl },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: color.surfaceSunken },
  identityText: { flex: 1 },
  name: { fontSize: type.title3.fontSize, fontWeight: type.title3.fontWeight, color: color.text },
  email: { marginTop: space.xxs, fontSize: type.caption.fontSize, color: color.textSecondary },

  rows: { borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: space.tapMin,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: type.body.fontSize, color: color.text },
  rowLabelPending: { color: color.textSecondary },
  rowMeta: { fontSize: type.caption.fontSize, color: color.textTertiary },
});
