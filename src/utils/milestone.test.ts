import { highestMilestoneAtMost, isMilestone } from './milestone';

describe('isMilestone', () => {
  test.each([3, 7, 14, 30, 50, 100, 200, 365, 400, 500, 1200])('%i is a Milestone', (days) => {
    expect(isMilestone(days)).toBe(true);
  });

  test.each([0, 1, 2, 4, 6, 8, 300, 364, 366, 399, 450])('%i is not a Milestone', (days) => {
    expect(isMilestone(days)).toBe(false);
  });
});

describe('highestMilestoneAtMost', () => {
  test.each([
    [0, null],
    [2, null],
    [3, 3],
    [6, 3],
    [16, 14],
    [364, 200],
    [365, 365],
    [399, 365],
    [400, 400],
    [499, 400],
    [1234, 1200],
  ])('%i -> %p', (days, expected) => {
    expect(highestMilestoneAtMost(days)).toBe(expected);
  });
});
