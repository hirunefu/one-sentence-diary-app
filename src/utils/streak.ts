import { addDays } from './date';

export function calculateStreak(sortedDescDates: string[], todayStr: string): number {
  if (sortedDescDates.length === 0) return 0;

  const yesterdayStr = addDays(todayStr, -1);
  const first = sortedDescDates[0]!;

  // 起点を today と yesterday の二段で許容する理由:
  // ユーザーが「今日まだ書いていない時点」でホーム画面を開いても、
  // 昨日まで連続で書いていれば streak をそのまま表示したい (書く前の励まし)。
  // 一昨日以前で途切れている場合は 0 にリセットする。
  let cursor: string;
  if (first === todayStr) {
    cursor = todayStr;
  } else if (first === yesterdayStr) {
    cursor = yesterdayStr;
  } else {
    return 0;
  }

  let streak = 0;
  for (const d of sortedDescDates) {
    if (d === cursor) {
      streak++;
      cursor = addDays(cursor, -1);
    } else if (d < cursor) {
      break;
    }
  }
  return streak;
}
