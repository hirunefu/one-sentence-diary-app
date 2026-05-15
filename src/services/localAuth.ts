import * as LocalAuthentication from 'expo-local-authentication';

export async function isLocalAuthAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return isEnrolled;
}

export async function authenticate(): Promise<boolean> {
  // disableDeviceFallback: false により、生体認証が連続で失敗した場合に
  // 端末のパスコード/パターン入力にフォールバックできる。
  // 怪我や眼鏡の有無で Face ID / 指紋が通らないケースを救うための妥協で、
  // 機密性より「自分が使えなくなる」リスクのほうが大きいと判断したため。
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'ロックを解除',
    cancelLabel: 'キャンセル',
    disableDeviceFallback: false,
  });
  return result.success;
}
