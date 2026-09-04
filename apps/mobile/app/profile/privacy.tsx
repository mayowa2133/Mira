import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@mira/ui';
import {
  DELETE_ACCOUNT_CONFIRMATION,
  PRIVACY_ACTIONS,
  type PrivacyAction,
} from '@/features/profile/rows';
import { useDeleteAccount, useSignOut } from '@/features/profile/queries';
import { describeLoadFailure } from '@/features/closet/load-failure';

/**
 * Privacy & data (`docs/07-security/privacy.md` §Your rights).
 *
 * > Privacy & data must expose, in one place: delete body images, delete
 * > try-ons, disconnect email and delete derived candidates, export data,
 * > delete account.
 *
 * Most of that has no subject yet — there are no body images or try-ons before
 * Phase 10. They are listed and labelled rather than hidden, because this is
 * the screen where a privacy policy is either kept or quietly not, and hiding
 * an unkeepable promise is how the gap goes unnoticed.
 */
export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [confirming, setConfirming] = useState(false);

  const deleteAccount = useDeleteAccount();
  const signOut = useSignOut();

  const failure =
    describeLoadFailure(deleteAccount.error, { message: "We couldn't start that." }) ??
    describeLoadFailure(signOut.error, { message: "We couldn't sign you out." });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
    >
      <Pressable onPress={() => router.back()} hitSlop={space.md} accessibilityLabel="Back">
        <Text style={styles.back}>‹</Text>
      </Pressable>
      <Text style={styles.title} accessibilityRole="header">
        Privacy &amp; data
      </Text>

      {deleteAccount.isSuccess ? (
        <View style={styles.done}>
          <Text style={styles.doneTitle}>Your account is being deleted.</Text>
          <Text style={styles.doneBody}>
            It can take a few minutes. You have been signed out on this device.
          </Text>
        </View>
      ) : (
        <>
          {PRIVACY_ACTIONS.map((action) => (
            <ActionRow
              key={action.key}
              action={action}
              busy={deleteAccount.isPending}
              onPress={() => action.key === 'account' && setConfirming(true)}
            />
          ))}

          {/* §4's rule applied here too: inline, never a system alert. */}
          {failure ? <Text style={styles.error}>{failure.message}</Text> : null}

          <Pressable
            style={styles.signOut}
            onPress={() => signOut.mutate()}
            accessibilityRole="button"
            testID="sign-out"
          >
            <Text style={styles.signOutLabel}>Sign out</Text>
          </Pressable>
        </>
      )}

      {/* The confirmation is part of the screen rather than an Alert, so it can
          state exactly what is removed — which auth-contract.md requires and a
          two-line system dialog cannot carry. */}
      {confirming ? (
        <View style={styles.confirm}>
          <Text style={styles.confirmTitle}>{DELETE_ACCOUNT_CONFIRMATION.title}</Text>
          <Text style={styles.confirmBody}>{DELETE_ACCOUNT_CONFIRMATION.body}</Text>

          <Pressable
            style={styles.destructive}
            disabled={deleteAccount.isPending}
            onPress={() => {
              setConfirming(false);
              deleteAccount.mutate();
            }}
            accessibilityRole="button"
            testID="confirm-delete-account"
          >
            <Text style={styles.destructiveLabel}>{DELETE_ACCOUNT_CONFIRMATION.confirm}</Text>
          </Pressable>

          {/* The escape route is the larger, calmer target. */}
          <Pressable
            style={styles.keep}
            onPress={() => setConfirming(false)}
            accessibilityRole="button"
          >
            <Text style={styles.keepLabel}>{DELETE_ACCOUNT_CONFIRMATION.cancel}</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function ActionRow({
  action,
  busy,
  onPress,
}: {
  action: PrivacyAction;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.action}
      disabled={!action.available || busy}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        action.available ? action.label : `${action.label}, ${action.blockedBy ?? 'unavailable'}`
      }
      testID={`privacy-${action.key}`}
    >
      <View style={styles.actionText}>
        <Text style={[styles.actionLabel, !action.available && styles.actionLabelPending]}>
          {action.label}
        </Text>
        <Text style={styles.actionDetail}>{action.detail}</Text>
      </View>
      {action.available ? null : <Text style={styles.blocked}>{action.blockedBy}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.screenX, paddingBottom: space.giant },
  back: { fontSize: 30, lineHeight: 34, color: color.text },
  title: {
    marginTop: space.sm,
    marginBottom: space.xl,
    fontSize: type.display.fontSize,
    lineHeight: type.display.lineHeight,
    fontWeight: type.display.fontWeight,
    letterSpacing: type.display.letterSpacing,
    color: color.text,
  },

  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: color.divider,
  },
  actionText: { flex: 1 },
  actionLabel: { fontSize: type.body.fontSize, color: color.text },
  actionLabelPending: { color: color.textSecondary },
  actionDetail: {
    marginTop: space.xxs,
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },
  blocked: { fontSize: type.caption.fontSize, color: color.textTertiary },

  error: { marginTop: space.lg, fontSize: type.subhead.fontSize, color: color.textSecondary },

  signOut: { marginTop: space.xxl, minHeight: space.tapMin, justifyContent: 'center' },
  signOutLabel: { fontSize: type.body.fontSize, color: color.text },

  confirm: {
    marginTop: space.xxl,
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
  },
  confirmTitle: {
    fontSize: type.title3.fontSize,
    fontWeight: type.title3.fontWeight,
    color: color.text,
  },
  confirmBody: {
    marginTop: space.sm,
    fontSize: type.subhead.fontSize,
    lineHeight: type.subhead.lineHeight,
    color: color.textSecondary,
  },
  destructive: {
    marginTop: space.xl,
    minHeight: space.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: color.danger,
  },
  destructiveLabel: { fontSize: type.body.fontSize, color: color.danger },
  keep: {
    marginTop: space.sm,
    minHeight: space.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: color.text,
  },
  keepLabel: { fontSize: type.body.fontSize, color: color.inverseText },

  done: { paddingVertical: space.xxl },
  doneTitle: {
    fontSize: type.title3.fontSize,
    fontWeight: type.title3.fontWeight,
    color: color.text,
  },
  doneBody: { marginTop: space.sm, fontSize: type.body.fontSize, color: color.textSecondary },
});
