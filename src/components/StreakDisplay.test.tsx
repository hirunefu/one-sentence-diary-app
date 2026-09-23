import React from 'react';
import { act, render } from '@testing-library/react-native';

jest.mock('../theme/useColors', () => {
  const { lightColors } = require('../theme/colors');
  return {
    useColors: () => lightColors,
    useIsDark: () => false,
  };
});

let mockReduceMotion = false;
jest.mock('../hooks/useReduceMotion', () => ({ useReduceMotion: () => mockReduceMotion }));

import { StreakDisplay } from './StreakDisplay';

const allRecorded = (todayStr: string) => {
  return Array.from({ length: 7 }, (_, i) => ({
    date: `2026-04-${22 + i}`,
    recorded: true,
    isToday: i === 6,
  }));
};

describe('StreakDisplay', () => {
  test('shows the streak number', async () => {
    const { getByText } = await render(<StreakDisplay days={7} last7={allRecorded('2026-04-28')} />);
    expect(getByText('7')).toBeTruthy();
    expect(getByText('日連続')).toBeTruthy();
  });

  test('shows 0 when days=0', async () => {
    const last7 = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${22 + i}`,
      recorded: false,
      isToday: i === 6,
    }));
    const { getByText } = await render(<StreakDisplay days={0} last7={last7} />);
    expect(getByText('0')).toBeTruthy();
  });

  test('renders 7 dots with correct testIDs', async () => {
    const { getByTestId } = await render(<StreakDisplay days={7} last7={allRecorded('2026-04-28')} />);
    for (let i = 0; i < 7; i++) {
      expect(getByTestId(`streak-dot-${i}`)).toBeTruthy();
    }
  });

  test('shows the "直近7日" label', async () => {
    const { getByText } = await render(<StreakDisplay days={7} last7={allRecorded('2026-04-28')} />);
    expect(getByText('直近7日')).toBeTruthy();
  });

  test('renders dots even when streak is 0', async () => {
    const last7 = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${22 + i}`,
      recorded: false,
      isToday: i === 6,
    }));
    const { getByTestId } = await render(<StreakDisplay days={0} last7={last7} />);
    expect(getByTestId('streak-dot-6')).toBeTruthy();
  });

  test('is read as one sentence by screen readers', async () => {
    const { getByLabelText } = await render(
      <StreakDisplay days={7} last7={allRecorded('2026-04-28')} />
    );
    expect(getByLabelText('7日連続。直近7日のうち7日記録あり')).toBeTruthy();
  });

  describe('when the Streak grows', () => {
    const weekEndingToday = (recordedToday: boolean) =>
      Array.from({ length: 7 }, (_, i) => ({
        date: `2026-04-${22 + i}`,
        recorded: i < 6 || recordedToday,
        isToday: i === 6,
      }));

    beforeEach(() => {
      jest.useFakeTimers();
      mockReduceMotion = false;
    });
    afterEach(() => jest.useRealTimers());

    test('rolls from the old number to the new one and keeps only the new one', async () => {
      const { queryByText, rerender } = await render(
        <StreakDisplay days={6} last7={weekEndingToday(false)} />
      );
      await rerender(<StreakDisplay days={7} last7={weekEndingToday(true)} />);
      // Mid-roll both numbers are drawn, but the outgoing one is hidden from
      // screen readers, which only ever get the new number.
      const hidden = { includeHiddenElements: true };
      expect(queryByText('6', hidden)).toBeTruthy();
      expect(queryByText('6')).toBeNull();
      expect(queryByText('7')).toBeTruthy();

      await act(() => jest.advanceTimersByTime(3000));
      expect(queryByText('6', hidden)).toBeNull();
      expect(queryByText('7')).toBeTruthy();
    });

    test('with reduce motion, shows the new number straight away', async () => {
      mockReduceMotion = true;
      const { queryByText, rerender } = await render(
        <StreakDisplay days={6} last7={weekEndingToday(false)} />
      );
      await rerender(<StreakDisplay days={7} last7={weekEndingToday(true)} />);
      expect(queryByText('6')).toBeNull();
      expect(queryByText('7')).toBeTruthy();
    });

    test('while inactive, keeps the old number until the screen is shown again', async () => {
      const { queryByText, rerender } = await render(
        <StreakDisplay days={6} last7={weekEndingToday(false)} active={false} />
      );
      await rerender(<StreakDisplay days={7} last7={weekEndingToday(true)} active={false} />);
      await act(() => jest.advanceTimersByTime(3000));
      expect(queryByText('6')).toBeTruthy();
      expect(queryByText('7')).toBeNull();

      await rerender(<StreakDisplay days={7} last7={weekEndingToday(true)} active />);
      await act(() => jest.advanceTimersByTime(3000));
      expect(queryByText('6')).toBeNull();
      expect(queryByText('7')).toBeTruthy();
    });
  });
});
