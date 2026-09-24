// What Home says about a break in the Streak. A lapse is not a failure: no
// blame or loss words, no count of missed days, no 0, no request, no deadline
// (showing a broken streak lowers the return to the behaviour; blaming oneself
// for the break lowers it further: Silverman & Barasch 2023).

// Two or more days missing: today is the new start (the fresh start effect).
export const RESTART_LINE = 'また今日から';

// Only yesterday missing. The number is exactly what Home shows after writing it.
export function repairLine(streakAfter: number): string {
  return `昨日の分を書けば、${streakAfter}日連続になります。`;
}

export const REPAIR_CLOSE_LABEL = '閉じる';
export const REPAIR_CLOSE_HINT = 'この案内を閉じます';
export const REPAIR_WRITE_LABEL = '昨日の分を書く';
