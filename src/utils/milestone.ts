// Milestones (CONTEXT.md): 3, 7, 14, 30, 50, 100, 200 and 365 days, then every
// multiple of 100 from 400.
const UNDER_400 = [3, 7, 14, 30, 50, 100, 200, 365] as const;

export function isMilestone(days: number): boolean {
  return (UNDER_400 as readonly number[]).includes(days) || (days >= 400 && days % 100 === 0);
}

// The highest Milestone a Streak of `days` has reached, or null below the first.
export function highestMilestoneAtMost(days: number): number | null {
  if (days >= 400) return Math.floor(days / 100) * 100;
  let highest: number | null = null;
  for (const m of UNDER_400) if (m <= days) highest = m;
  return highest;
}
