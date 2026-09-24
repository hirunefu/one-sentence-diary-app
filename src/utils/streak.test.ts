import {
  calculateStreak,
  currentStretch,
  holderOf,
  longestStreak,
  streakBreakOf,
  stretchesOf,
} from './streak';
import { addDays } from './date';

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

describe('streakBreakOf', () => {
  const TODAY = '2026-05-15';
  const days = (...offsets: number[]) => offsets.map((o) => addDays(TODAY, o)).sort().reverse();
  const breakOf = (dates: string[], declined: string | null = null, today = TODAY) =>
    streakBreakOf(stretchesOf(dates, today), today, declined);

  test('says nothing about a break before the first Entry', () => {
    expect(breakOf([])).toEqual({ headline: 'count', offer: null });
    expect(breakOf(['2026-05-20'])).toEqual({ headline: 'count', offer: null });
  });

  test('says nothing while the Streak holds through yesterday', () => {
    expect(breakOf(days(-1, -2))).toEqual({ headline: 'count', offer: null });
    expect(breakOf(days(0, -1))).toEqual({ headline: 'count', offer: null });
  });

  test('only yesterday missing: offers the repair and shows no number', () => {
    expect(breakOf(days(-2, -3, -4))).toEqual({
      headline: 'blank',
      offer: { missingDay: '2026-05-14', streakAfter: 4 },
    });
  });

  test('a one-day stretch before the gap can be repaired too', () => {
    expect(breakOf(days(-2)).offer).toEqual({ missingDay: '2026-05-14', streakAfter: 2 });
  });

  test('with today written, the Streak shows and the offer counts today', () => {
    expect(breakOf(days(0, -2, -3))).toEqual({
      headline: 'count',
      offer: { missingDay: '2026-05-14', streakAfter: 4 },
    });
  });

  test('two or more days missing: 「また今日から」, no offer', () => {
    expect(breakOf(days(-3, -4))).toEqual({ headline: 'restart', offer: null });
    expect(breakOf(days(0, -3, -4))).toEqual({ headline: 'count', offer: null });
  });

  test('a declined day is not offered again', () => {
    expect(breakOf(days(-2, -3), '2026-05-14')).toEqual({ headline: 'restart', offer: null });
    expect(breakOf(days(0, -2, -3), '2026-05-14')).toEqual({ headline: 'count', offer: null });
    expect(breakOf(days(-2, -3), '2026-05-13').offer?.missingDay).toBe('2026-05-14');
  });

  test('the offer is for yesterday only: the next day it is gone', () => {
    expect(breakOf(days(-2, -3), null, '2026-05-16')).toEqual({ headline: 'restart', offer: null });
  });

  test('ignores Entries dated after today', () => {
    expect(breakOf(['2026-05-20', ...days(-2, -3)]).offer?.streakAfter).toBe(3);
  });

  test('crosses a month boundary', () => {
    const dates = ['2026-05-30', '2026-05-29'];
    expect(breakOf(dates, null, '2026-06-01').offer).toEqual({
      missingDay: '2026-05-31',
      streakAfter: 3,
    });
  });

  test('keeps its promises for every pattern of Entries over the last nine days', () => {
    for (const declined of [null, addDays(TODAY, -1)]) {
      for (let mask = 0; mask < 512; mask++) {
        const offsets = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((i) => mask & (1 << i));
        const dates = days(...offsets.map((i) => -i));
        const { headline, offer } = breakOf(dates, declined);
        const has = (o: number) => dates.includes(addDays(TODAY, o));
        const streak = calculateStreak(dates, TODAY);
        const repairable = !has(-1) && has(-2) && declined !== addDays(TODAY, -1);
        expect(offer !== null).toBe(repairable);
        if (offer) {
          expect(offer.missingDay).toBe(addDays(TODAY, -1));
          const repaired = [...dates, addDays(TODAY, -1)].sort().reverse();
          expect(offer.streakAfter).toBe(calculateStreak(repaired, TODAY));
        }
        expect(headline === 'blank').toBe(streak === 0 && offer !== null);
        expect(headline === 'restart').toBe(streak === 0 && dates.length > 0 && offer === null);
      }
    }
  });
});
