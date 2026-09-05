import * as LocalAuthentication from 'expo-local-authentication';

/**
 * The biometric gate (auth-contract.md rule 6).
 *
 * > Biometric re-authentication gates the body profile and try-on surfaces
 * > **when the device supports it**.
 *
 * That last clause is the whole design. A device with no biometrics, or with
 * none enrolled, must still be able to reach its own body profile — locking
 * someone out of their own photographs because their phone has no Face ID would
 * be a worse outcome than the one the gate prevents.
 *
 * So this is a courtesy lock, not a security boundary. The security boundary is
 * `user_id` scoping and RLS at the API, which does not trust anything the
 * client says about a fingerprint. Anyone reading this later should not mistake
 * the gate for the protection.
 */
export type GateResult =
  | { ok: true; reason: 'authenticated' | 'unsupported' | 'not-enrolled' }
  | { ok: false; reason: 'failed' | 'cancelled' };

export async function unlockBodyProfile(): Promise<GateResult> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return { ok: true, reason: 'unsupported' };

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) return { ok: true, reason: 'not-enrolled' };

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock your body profile',
    // A passcode fallback keeps someone whose face is not recognised — a new
    // haircut, a dark room — from being shut out of their own photographs.
    disableDeviceFallback: false,
    cancelLabel: 'Not now',
  });

  if (result.success) return { ok: true, reason: 'authenticated' };
  return {
    ok: false,
    reason: 'error' in result && result.error === 'user_cancel' ? 'cancelled' : 'failed',
  };
}

/** What to say when the gate refuses. Never blames the user. */
export function describeGateFailure(reason: 'failed' | 'cancelled'): string {
  return reason === 'cancelled'
    ? 'Unlock to see your photos.'
    : "That didn't unlock. Try again, or use your passcode.";
}
