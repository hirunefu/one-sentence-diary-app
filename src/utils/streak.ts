import { addDays } from './date';

export function calculateStreak(sortedDescDates: string[], todayStr: string): number {
  if (sortedDescDates.length === 0) return 0;

  const yesterdayStr = addDays(todayStr, -1);
  const first = sortedDescDates[0]!;

  // Allow two valid anchors (today and yesterday): when the user opens the
  // app before writing today's entry, the streak should still be visible as
  // long as they wrote yesterday — encouragement before the action.
  // If the most recent entry is older than yesterday, the streak resets to 0.
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
