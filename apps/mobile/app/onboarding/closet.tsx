import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import { Icon } from '@/ui/Icon';
import { CLOSET_ROUTES } from '@/features/onboarding/state';
import { useSetOnboardingState } from '@/features/identity/queries';

/**
 * Build your closet (§5).
 *
 * > The most important onboarding screen — it must communicate that Mira
 * > handles closets that already exist.
 *
 * Which is the whole reason email leads and gets the largest card: it has the
 * highest item-per-action yield, and someone with two hundred garments needs to
 * see that Mira is not asking them to photograph all of them.
 *
 * Three of the four routes are not built yet. They are shown, labelled as
 * coming, rather than hidden — hiding them would make the screen argue the
 * opposite of its own point.
 */
export default function BuildClosetScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const setState = useSetOnboardingState();
  const [lead, ...rest] = CLOSET_ROUTES;

  /**
   * Leave onboarding, recording that it happened.
   *
   * The navigation does NOT wait on the write. A tertiary action should not
   * grow a spinner, and the cost of the write failing is seeing this screen
   * once more — far cheaper than holding someone on it while a request retries.
   */
  const leave = (to: string, state: 'completed' | 'skipped') => {
    setState.mutate(state);
    router.replace(to as never);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.giant }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headline} accessibilityRole="header">
          Let&apos;s find what you already own
        </Text>

        <Pressable
          style={[styles.card, !lead.to && styles.cardPending]}
          disabled={!lead.to}
          onPress={() => lead.to && leave(lead.to, 'completed')}
          accessibilityRole="button"
          accessibilityLabel={`${lead.title}. ${lead.body ?? ''}`}
          testID="onboarding-route-email"
        >
          <View style={styles.cardIcon}>
            <Icon name={lead.icon} size={28} color={lead.to ? color.text : color.textSecondary} />
          </View>
          <Text style={styles.cardTitle}>{lead.title}</Text>
          {lead.body ? <Text style={styles.cardBody}>{lead.body}</Text> : null}
          {lead.status ? <Text style={styles.pending}>{lead.status}</Text> : null}
        </Pressable>

        {rest.map((route) => (
          <Pressable
            key={route.key}
            style={styles.row}
            disabled={!route.to}
            onPress={() => route.to && leave(route.to, 'completed')}
            accessibilityRole="button"
            accessibilityLabel={route.title}
            testID={`onboarding-route-${route.key}`}
          >
            <View style={styles.rowIcon}>
              <Icon
                name={route.icon}
                size={20}
                color={route.to ? color.text : color.textTertiary}
              />
            </View>
            <Text style={[styles.rowLabel, !route.to && styles.rowLabelPending]}>
              {route.title}
            </Text>
            {route.status ? (
              <Text style={styles.pending}>{route.status}</Text>
            ) : (
              <Icon name="chevronRight" size={18} color={color.textTertiary} />
            )}
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.xl }]}>
        {/* Tertiary, never styled as failure (§5). */}
        <Pressable
          style={styles.tertiary}
          onPress={() => leave('/', 'skipped')}
          accessibilityRole="button"
          testID="onboarding-later"
        >
          <Text style={styles.tertiaryLabel}>I&apos;ll do this later</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.screenX, paddingBottom: space.xl },
  headline: {
    marginBottom: space.xxl,
    fontSize: type.display.fontSize,
    lineHeight: type.display.lineHeight,
    fontWeight: type.display.fontWeight,
    letterSpacing: type.display.letterSpacing,
    color: color.text,
  },

  card: {
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    marginBottom: space.md,
  },
  cardPending: { opacity: 0.7 },
  cardIcon: { marginBottom: space.sm },
  cardTitle: {
    marginTop: space.md,
    fontSize: type.title3.fontSize,
    fontWeight: type.title3.fontWeight,
    color: color.text,
  },
  cardBody: {
    marginTop: space.xs,
    fontSize: type.subhead.fontSize,
    lineHeight: type.subhead.lineHeight,
    color: color.textSecondary,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: space.tapMin,
    paddingVertical: space.md,
  },
  rowIcon: { width: space.xxxl },
  rowLabel: { flex: 1, fontSize: type.body.fontSize, color: color.text },
  rowLabelPending: { color: color.textSecondary },
  pending: { marginTop: space.sm, fontSize: type.caption.fontSize, color: color.textTertiary },

  footer: { paddingHorizontal: space.screenX },
  tertiary: { minHeight: space.tapMin, alignItems: 'center', justifyContent: 'center' },
  tertiaryLabel: { fontSize: type.subhead.fontSize, color: color.textSecondary },
});
