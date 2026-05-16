import { toDateString, fromDateString, today, yesterday, addDays } from './date';

describe('toDateString', () => {
  test('formats local date as YYYY-MM-DD', () => {
    const d = new Date(2026, 3, 28, 15, 30); // 2026-04-28 (month is 0-indexed)
    expect(toDateString(d)).toBe('2026-04-28');
  });

  test('pads single-digit month and day', () => {
    const d = new Date(2026, 0, 5);
    expect(toDateString(d)).toBe('2026-01-05');
  });

  test('handles year boundary', () => {
    const d = new Date(2025, 11, 31);
    expect(toDateString(d)).toBe('2025-12-31');
  });
});

describe('fromDateString', () => {
  test('parses YYYY-MM-DD into a Date at local midnight', () => {
    const d = fromDateString('2026-04-28');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(28);
    expect(d.getHours()).toBe(0);
  });
});

describe('today', () => {
  test('returns todays date string in local TZ', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(today()).toBe(expected);
  });
});

describe('yesterday', () => {
  test('returns yesterdays date string', () => {
    const now = new Date();
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const expected = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    expect(yesterday()).toBe(expected);
  });
});

describe('today / yesterday under EXPO_PUBLIC_E2E_TODAY', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.EXPO_PUBLIC_E2E;
    delete process.env.EXPO_PUBLIC_E2E_TODAY;
  });

  test('today() returns the override when both EXPO_PUBLIC_E2E and the override are set', () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    process.env.EXPO_PUBLIC_E2E_TODAY = '2026-05-15';
    const { today } = require('./date');
    expect(today()).toBe('2026-05-15');
  });

  test('today() ignores the override when EXPO_PUBLIC_E2E is unset', () => {
    process.env.EXPO_PUBLIC_E2E_TODAY = '2026-05-15';
    const { today } = require('./date');
    expect(today()).not.toBe('2026-05-15');
  });

  test('yesterday() returns override minus one day when override is set', () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    process.env.EXPO_PUBLIC_E2E_TODAY = '2026-05-15';
    const { yesterday } = require('./date');
    expect(yesterday()).toBe('2026-05-14');
  });
});

describe('addDays', () => {
  test('adds positive days', () => {
    expect(addDays('2026-04-28', 1)).toBe('2026-04-29');
  });

  test('subtracts negative days', () => {
    expect(addDays('2026-04-28', -1)).toBe('2026-04-27');
  });

  test('crosses month boundary', () => {
    expect(addDays('2026-04-30', 1)).toBe('2026-05-01');
  });

  test('crosses year boundary', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
  });

  test('handles leap year (2028 is leap)', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  test('handles non-leap year (2026)', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});
