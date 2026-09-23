import { celebrationCopy } from './celebrationCopy';
import type { Celebration } from './celebration';

const celebration = (over: Partial<Celebration>): Celebration => ({
  stretchStart: '2026-05-09',
  streak: 7,
  milestone: 7,
  previousLongest: null,
  ...over,
});

describe('celebrationCopy', () => {
  test('a Milestone names the length in the headline', () => {
    const copy = celebrationCopy(celebration({ streak: 7, milestone: 7 }));
    expect(copy.number).toBe('7');
    expect(copy.headline).toBe('1週間、続きました。');
    expect(copy.longest).toBeNull();
  });

  test.each([
    [3, '3日、続きました。'],
    [14, '2週間、続きました。'],
    [30, 'ひと月、続きました。'],
    [365, '1年、続きました。'],
    [400, '400日、続きました。'],
    [1200, '1200日、続きました。'],
  ])('Milestone %i: %s', (milestone, headline) => {
    expect(celebrationCopy(celebration({ streak: milestone, milestone })).headline).toBe(headline);
  });

  test('after a Backfill jump the big number is the Streak and the headline the Milestone', () => {
    const copy = celebrationCopy(celebration({ streak: 16, milestone: 14 }));
    expect(copy.number).toBe('16');
    expect(copy.headline).toBe('2週間、続きました。');
  });

  test('a new Longest streak on a Milestone day is one extra line', () => {
    const copy = celebrationCopy(celebration({ streak: 14, milestone: 14, previousLongest: 13 }));
    expect(copy.headline).toBe('2週間、続きました。');
    expect(copy.longest).toBe('これまでの最長記録（13日）を超えました。');
  });

  test('a new Longest streak alone has its own headline and line', () => {
    const copy = celebrationCopy(celebration({ streak: 11, milestone: null, previousLongest: 10 }));
    expect(copy.number).toBe('11');
    expect(copy.headline).toBe('いちばん長く続いています。');
    expect(copy.line).toBe('これまでの最長記録は10日でした。');
    expect(copy.longest).toBeNull();
  });

  test('is read aloud as it is shown, in order', () => {
    const copy = celebrationCopy(celebration({ streak: 14, milestone: 14, previousLongest: 13 }));
    expect(copy.spoken).toBe(`14日連続。${copy.headline}${copy.line}${copy.longest}`);
  });

  test('stays calm: no exclamation, no pressure, none of the words to avoid', () => {
    const forbidden = /[！!]|明日も|この調子|目標|次は|がんば|達成|バッジ|レベル|自己ベスト/;
    const days = [3, 7, 14, 30, 50, 100, 200, 365, 400, 500, 1200];
    const all = days.flatMap((m) => [
      celebrationCopy(celebration({ streak: m, milestone: m })),
      celebrationCopy(celebration({ streak: m, milestone: m, previousLongest: m - 1 })),
      celebrationCopy(celebration({ streak: m + 1, milestone: null, previousLongest: m })),
    ]);
    for (const copy of all) expect(copy.spoken).not.toMatch(forbidden);
  });
});
