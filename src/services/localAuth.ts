import * as LocalAuthentication from 'expo-local-authentication';

export async function isLocalAuthAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return isEnrolled;
}

export async function authenticate(): Promise<boolean> {
  // disableDeviceFallback: false lets the user fall back to the device
  // passcode/pattern after repeated biometric failures. Deliberate trade-off:
  // we'd rather rescue a user who can't pass Face ID / fingerprint (injury,
  // glasses, etc.) than enforce biometric-only entry. Self-lockout risk is
  // judged greater than the marginal confidentiality gain.
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'ロックを解除',
    cancelLabel: 'キャンセル',
    disableDeviceFallback: false,
  });
  return result.success;
}
