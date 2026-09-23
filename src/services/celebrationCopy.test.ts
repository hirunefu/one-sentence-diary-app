import { celebrationCopy, longestTodayCopy } from './celebrationCopy';
import type { MilestoneCelebration } from './celebration';

const celebration = (over: Partial<MilestoneCelebration>): MilestoneCelebration => ({
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

  test('3 leaves the pace to the writer, without addressing them', () => {
    expect(celebrationCopy(celebration({ streak: 3, milestone: 3 })).line).toBe(
      '一文ずつ、自分のペースで。'
    );
  });

  test('1000 has its own line', () => {
    const copy = celebrationCopy(celebration({ streak: 1000, milestone: 1000 }));
    expect(copy.headline).toBe('1000日、続きました。');
    expect(copy.line).toBe('1000日分の一文が、ここにあります。');
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
    expect(copy.longest).toBe('最長記録だった13日を、超えました。');
  });

  test('a new Longest streak alone is told in place, in two short sentences', () => {
    const copy = longestTodayCopy(10);
    expect(copy.headline).toBe('いちばん長く続いています。');
    expect(copy.line).toBe('これまでの最長記録は、10日でした。');
    expect(copy.spoken).toBe('いちばん長く続いています。これまでの最長記録は、10日でした。');
  });

  test('is read aloud as it is shown, in order', () => {
    const copy = celebrationCopy(celebration({ streak: 14, milestone: 14, previousLongest: 13 }));
    expect(copy.spoken).toBe(`14日連続。${copy.headline}${copy.line}${copy.longest}`);
  });

  const everyMilestoneCopy = () =>
    [3, 7, 14, 30, 50, 100, 200, 365, 400, 500, 1000, 1200].flatMap((m) => [
      celebrationCopy(celebration({ streak: m, milestone: m })),
      celebrationCopy(celebration({ streak: m, milestone: m, previousLongest: m - 1 })),
    ]);

  test('stays calm: no exclamation, no request, no claim, none of the words to avoid', () => {
    const forbidden =
      /[！!]|あなた|明日も|この調子|続けましょう|目標|次は|がんば|習慣になりました|達成|バッジ|レベル|自己ベスト/;
    const all = [...everyMilestoneCopy().map((c) => c.spoken), longestTodayCopy(10).spoken];
    for (const spoken of all) expect(spoken).not.toMatch(forbidden);
  });

  // Lines wrap only after 「、」 at large font sizes, so each needs one.
  test('every line can wrap between phrases', () => {
    for (const copy of everyMilestoneCopy()) {
      expect(copy.line).toContain('、');
      if (copy.longest) expect(copy.longest).toContain('、');
    }
    expect(longestTodayCopy(10).line).toContain('、');
  });
});
