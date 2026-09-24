import { addDays } from './date';

// A maximal stretch of consecutive days that each have an Entry (dates are
// YYYY-MM-DD, both ends inclusive). The Streak is the stretch ending today, or
// ending yesterday while today has no Entry yet; the Longest streak is the
// longest stretch.
export type Stretch = { start: string; end: string; length: number };

// Newest stretch first. Days after today (Entries left over from versions that
// let the calendar write future days) and duplicates are ignored.
export function stretchesOf(sortedDescDates: readonly string[], todayStr: string): Stretch[] {
  const stretches: Stretch[] = [];
  let current = null as Stretch | null;
  for (const date of sortedDescDates) {
    if (date > todayStr || date === current?.start) continue;
    if (current && date === addDays(current.start, -1)) {
      current.start = date;
      current.length++;
    } else {
      current = { start: date, end: date, length: 1 };
      stretches.push(current);
    }
  }
  return stretches;
}

// Two valid anchors (today and yesterday): when the user opens the app before
// writing today's Entry, the Streak should still be visible as long as they
// wrote yesterday — encouragement before the action.
export function currentStretch(stretches: readonly Stretch[], todayStr: string): Stretch | null {
  const newest = stretches[0];
  if (!newest) return null;
  return newest.end === todayStr || newest.end === addDays(todayStr, -1) ? newest : null;
}

export function longestStreak(stretches: readonly Stretch[]): number {
  return stretches.reduce((longest, s) => Math.max(longest, s.length), 0);
}

// The stretch that holds the Longest streak. On a tie the older stretch keeps it.
export function holderOf(stretches: readonly Stretch[]): Stretch | null {
  let holder: Stretch | null = null;
  for (const s of stretches) {
    if (!holder || s.length >= holder.length) holder = s;
  }
  return holder;
}

export function calculateStreak(sortedDescDates: readonly string[], todayStr: string): number {
  return currentStretch(stretchesOf(sortedDescDates, todayStr), todayStr)?.length ?? 0;
}

// What Home says about a break in the Streak (Streak repair in CONTEXT.md).
// - count: the Streak as a number (also before the first Entry, which is not a break);
// - restart: two or more days missing: 「また今日から」, never a 0;
// - blank: only yesterday missing and today unwritten: no number, the offer speaks.
export type StreakHeadline = 'count' | 'restart' | 'blank';
// Offered only when yesterday is the one missing day. streakAfter is exactly what
// Home shows once yesterday has an Entry (it counts today if written).
export type RepairOffer = { missingDay: string; streakAfter: number };
export type StreakBreak = { headline: StreakHeadline; offer: RepairOffer | null };

export function streakBreakOf(
  stretches: readonly Stretch[],
  todayStr: string,
  // The missing day whose offer was closed (or whose Entry was deleted).
  declinedDay: string | null
): StreakBreak {
  const newest = stretches[0];
  if (!newest) return { headline: 'count', offer: null };
  const yesterday = addDays(todayStr, -1);
  const todayWritten = newest.end === todayStr;
  const yesterdayWritten = todayWritten ? newest.length > 1 : newest.end === yesterday;
  if (yesterdayWritten) return { headline: 'count', offer: null };
  const before = todayWritten ? stretches[1] : newest;
  const offer =
    before !== undefined && before.end === addDays(todayStr, -2) && declinedDay !== yesterday
      ? { missingDay: yesterday, streakAfter: before.length + 1 + (todayWritten ? 1 : 0) }
      : null;
  return { headline: todayWritten ? 'count' : offer ? 'blank' : 'restart', offer };
}
