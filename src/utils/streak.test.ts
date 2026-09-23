import { calculateStreak, currentStretch, holderOf, longestStreak, stretchesOf } from './streak';

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

  // Versions before 1.3.0 let the calendar write future days, and such Entries
  // can still be in the database.
  test('ignores Entries dated after today', () => {
    expect(calculateStreak(
      ['2026-06-01', '2026-04-28', '2026-04-27'],
      '2026-04-28'
    )).toBe(2);
  });
});

describe('stretchesOf', () => {
  test('groups consecutive days, newest stretch first', () => {
    expect(stretchesOf(
      ['2026-05-02', '2026-05-01', '2026-04-30', '2026-04-27', '2026-04-26'],
      '2026-05-02'
    )).toEqual([
      { start: '2026-04-30', end: '2026-05-02', length: 3 },
      { start: '2026-04-26', end: '2026-04-27', length: 2 },
    ]);
  });

  test('crosses a year boundary', () => {
    expect(stretchesOf(['2027-01-01', '2026-12-31'], '2027-01-01')).toEqual([
      { start: '2026-12-31', end: '2027-01-01', length: 2 },
    ]);
  });

  test('ignores duplicates and days after today', () => {
    const dates = ['2026-05-09', '2026-05-02', '2026-05-02', '2026-05-01'];
    expect(stretchesOf(dates, '2026-05-02')).toEqual([
      { start: '2026-05-01', end: '2026-05-02', length: 2 },
    ]);
  });
});

describe('currentStretch', () => {
  const stretches = (dates: string[], today: string) => stretchesOf(dates, today);

  test('is the stretch ending today', () => {
    const today = '2026-05-02';
    expect(currentStretch(stretches(['2026-05-02', '2026-05-01'], today), today)).toEqual({
      start: '2026-05-01',
      end: '2026-05-02',
      length: 2,
    });
  });

  test('is the stretch ending yesterday while today has no Entry yet', () => {
    const today = '2026-05-03';
    expect(currentStretch(stretches(['2026-05-02', '2026-05-01'], today), today)?.length).toBe(2);
  });

  test('is null when the newest Entry is older than yesterday', () => {
    const today = '2026-05-04';
    expect(currentStretch(stretches(['2026-05-02', '2026-05-01'], today), today)).toBeNull();
  });
});

describe('longestStreak', () => {
  test('is 0 without Entries', () => {
    expect(longestStreak([])).toBe(0);
  });

  test('includes the current Streak', () => {
    const today = '2026-05-10';
    const dates = ['2026-05-10', '2026-05-09', '2026-05-08', '2026-05-01', '2026-04-30'];
    expect(longestStreak(stretchesOf(dates, today))).toBe(3);
  });

  test('can be an earlier stretch', () => {
    const today = '2026-05-10';
    const dates = ['2026-05-10', '2026-05-03', '2026-05-02', '2026-05-01'];
    expect(longestStreak(stretchesOf(dates, today))).toBe(3);
  });
});

describe('holderOf', () => {
  test('on a tie, the older stretch keeps the Longest streak', () => {
    const today = '2026-05-10';
    const dates = ['2026-05-10', '2026-05-09', '2026-05-02', '2026-05-01'];
    expect(holderOf(stretchesOf(dates, today))?.start).toBe('2026-05-01');
  });

  test('is null without Entries', () => {
    expect(holderOf([])).toBeNull();
  });
});
