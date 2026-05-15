import * as LocalAuthentication from 'expo-local-authentication';
import { IS_E2E } from '../config/e2eMode';

export async function isLocalAuthAvailable(): Promise<boolean> {
  // Skip the hardware/enrollment probe under E2E so the suite runs on
  // emulators that don't expose biometrics.
  if (IS_E2E) return true;
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return isEnrolled;
}

export async function authenticate(): Promise<boolean> {
  // Skip the OS biometric prompt under E2E — Maestro can't drive system
  // dialogs. Real-device behavior is covered by manual QA.
  if (IS_E2E) return true;
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
