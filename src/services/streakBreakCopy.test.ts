import {
  REPAIR_CLOSE_HINT,
  REPAIR_CLOSE_LABEL,
  REPAIR_WRITE_LABEL,
  RESTART_LINE,
  repairLine,
} from './streakBreakCopy';

describe('streakBreakCopy', () => {
  test('says what writing yesterday gives', () => {
    expect(repairLine(13)).toBe('昨日の分を書けば、13日連続になります。');
  });

  test('a break is met with 「また今日から」', () => {
    expect(RESTART_LINE).toBe('また今日から');
  });

  test('the buttons say what they do', () => {
    expect(REPAIR_CLOSE_LABEL).toBe('閉じる');
    expect(REPAIR_CLOSE_HINT).toBe('この案内を閉じます');
    expect(REPAIR_WRITE_LABEL).toBe('昨日の分を書く');
  });

  // No blame, no loss, no request, no deadline, no 0: a lapse is not a failure.
  test('stays calm', () => {
    const forbidden =
      /[！!]|あなた|途切れ|リセット|残念|しましょう|ください|明日|来週|今日中|までに|あと\d|(^|\D)0日|戻ります/;
    const all = [2, 3, 4, 7, 10, 100, 400].map(repairLine);
    const labels = [RESTART_LINE, REPAIR_CLOSE_LABEL, REPAIR_CLOSE_HINT, REPAIR_WRITE_LABEL];
    for (const text of [...all, ...labels]) {
      expect(text).not.toMatch(forbidden);
    }
  });

  test('the repair line can wrap between phrases', () => {
    expect(repairLine(4)).toContain('、');
  });
});
