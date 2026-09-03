import type { ReactNode } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, space, type } from '@mira/ui';

/**
 * Shared screen shell.
 *
 * Reads design tokens only — no literal colour, spacing or radius values in
 * feature code (`docs/02-design/design-system.md` §10). Enforced by ESLint.
 */
export function Screen({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {action}
        </View>
        {children}
      </ScrollView>
    </View>
  );
}

/**
 * Empty state.
 *
 * A warm sentence plus one obvious route out — never "No data"
 * (`docs/02-design/states-and-errors.md` — Empty states).
 */
export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyMessage}>{message}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.screenX, paddingBottom: space.giant },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: space.lg,
    paddingBottom: space.xxl,
  },
  headerText: { flex: 1 },
  title: {
    fontSize: type.title1.fontSize,
    lineHeight: type.title1.lineHeight,
    fontWeight: type.title1.fontWeight,
    letterSpacing: type.title1.letterSpacing,
    color: color.text,
  },
  subtitle: {
    marginTop: space.xs,
    fontSize: type.subhead.fontSize,
    lineHeight: type.subhead.lineHeight,
    color: color.textSecondary,
  },
  empty: {
    paddingVertical: space.massive,
    alignItems: 'flex-start',
  },
  emptyMessage: {
    fontSize: type.title3.fontSize,
    lineHeight: type.title3.lineHeight,
    fontWeight: type.title3.fontWeight,
    color: color.text,
  },
  emptyHint: {
    marginTop: space.sm,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: color.textSecondary,
  },
});
