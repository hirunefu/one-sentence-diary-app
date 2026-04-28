import { addDays } from './date';

export function calculateStreak(sortedDescDates: string[], todayStr: string): number {
  if (sortedDescDates.length === 0) return 0;

  const yesterdayStr = addDays(todayStr, -1);
  const first = sortedDescDates[0]!;

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
