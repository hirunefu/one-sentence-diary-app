import * as LocalAuthentication from 'expo-local-authentication';

export async function isLocalAuthAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return isEnrolled;
}

export async function authenticate(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'ロックを解除',
    cancelLabel: 'キャンセル',
    disableDeviceFallback: false,
  });
  return result.success;
}
