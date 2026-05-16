import { IS_E2E } from '../config/e2eMode';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromDateString(s: string): Date {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

// E2E builds may pin "today" to a specific YYYY-MM-DD via EXPO_PUBLIC_E2E_TODAY.
// This lets streak / streak_break flows assume a fixed reference date without
// requiring `adb root` on the device (the prior approach failed on Google Play
// system images). The constant is inlined by Metro at build time, so each
// --at-date value requires a fresh build.
const E2E_TODAY_OVERRIDE = process.env.EXPO_PUBLIC_E2E_TODAY ?? '';

export function today(): string {
  if (IS_E2E && E2E_TODAY_OVERRIDE) return E2E_TODAY_OVERRIDE;
  return toDateString(new Date());
}

export function yesterday(): string {
  if (IS_E2E && E2E_TODAY_OVERRIDE) {
    return addDays(E2E_TODAY_OVERRIDE, -1);
  }
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateString(d);
}

export function addDays(dateStr: string, days: number): string {
  const d = fromDateString(dateStr);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}
