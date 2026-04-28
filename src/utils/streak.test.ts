import { calculateStreak } from './streak';

describe('calculateStreak', () => {
  test('returns 0 for empty list', () => {
    expect(calculateStreak([], '2026-04-28')).toBe(0);
  });

  test('returns 1 if only today is recorded', () => {
    expect(calculateStreak(['2026-04-28'], '2026-04-28')).toBe(1);
  });

  test('returns N for N consecutive days ending today', () => {
    expect(calculateStreak(
      ['2026-04-28', '2026-04-27', '2026-04-26'],
      '2026-04-28'
    )).toBe(3);
  });

  test('returns previous streak when today is unrecorded but yesterday is', () => {
    expect(calculateStreak(
      ['2026-04-27', '2026-04-26', '2026-04-25'],
      '2026-04-28'
    )).toBe(3);
  });

  test('returns 0 when today and yesterday both unrecorded', () => {
    expect(calculateStreak(
      ['2026-04-26', '2026-04-25'],
      '2026-04-28'
    )).toBe(0);
  });

  test('breaks at first gap', () => {
    expect(calculateStreak(
      ['2026-04-28', '2026-04-27', '2026-04-25'],
      '2026-04-28'
    )).toBe(2);
  });

  test('crosses month boundary', () => {
    expect(calculateStreak(
      ['2026-05-01', '2026-04-30', '2026-04-29'],
      '2026-05-01'
    )).toBe(3);
  });
});
