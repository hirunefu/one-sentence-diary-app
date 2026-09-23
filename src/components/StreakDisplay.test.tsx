import React, { Profiler } from 'react';
import { StyleSheet } from 'react-native';
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

  describe('when the Streak changes', () => {
    const weekEndingToday = (recordedToday: boolean) =>
      Array.from({ length: 7 }, (_, i) => ({
        date: `2026-04-${22 + i}`,
        recorded: i < 6 || recordedToday,
        isToday: i === 6,
      }));
    const hidden = { includeHiddenElements: true };

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
      expect(queryByText('6', hidden)).toBeTruthy();
      expect(queryByText('6')).toBeNull();
      expect(queryByText('7')).toBeTruthy();

      await act(() => jest.advanceTimersByTime(3000));
      expect(queryByText('6', hidden)).toBeNull();
      expect(queryByText('7')).toHaveStyle({ opacity: 1 });
    });

    test('never draws a frame with the new number already in place before the roll', async () => {
      const frames: string[][] = [];
      let recording = false;
      const view = (days: number, recordedToday: boolean) => (
        <Profiler id="streak" onRender={() => recording && frames.push(visibleNumbers())}>
          <StreakDisplay days={days} last7={weekEndingToday(recordedToday)} />
        </Profiler>
      );
      const { rerender, toJSON } = await render(view(6, false));
      const visibleNumbers = () => numbersAtFullOpacity(toJSON());

      recording = true;
      await rerender(view(7, true));
      recording = false;

      expect(frames.length).toBeGreaterThan(0);
      expect(frames[0]).toEqual(['6']);
      expect(frames.every((f) => !f.includes('7'))).toBe(true);
    });

    test('coming back to the screen, the first frame still shows the old number', async () => {
      const frames: string[][] = [];
      let recording = false;
      const view = (days: number, active: boolean) => (
        <Profiler id="streak" onRender={() => recording && frames.push(visibleNumbers())}>
          <StreakDisplay days={days} last7={weekEndingToday(days === 7)} active={active} />
        </Profiler>
      );
      const { rerender, toJSON } = await render(view(6, true));
      const visibleNumbers = () => numbersAtFullOpacity(toJSON());
      await rerender(view(7, false));

      recording = true;
      await rerender(view(7, true));
      recording = false;

      expect(frames[0]).toEqual(['6']);
      expect(frames.every((f) => !f.includes('7'))).toBe(true);
    });

    test('a shrinking Streak changes without a roll', async () => {
      const { queryByText, rerender } = await render(
        <StreakDisplay days={7} last7={weekEndingToday(true)} />
      );
      await rerender(<StreakDisplay days={6} last7={weekEndingToday(false)} />);
      expect(queryByText('7', hidden)).toBeNull();
      expect(queryByText('6')).toHaveStyle({ opacity: 1 });
    });

    test('with reduce motion, shows the new number straight away', async () => {
      mockReduceMotion = true;
      const { queryByText, rerender } = await render(
        <StreakDisplay days={6} last7={weekEndingToday(false)} />
      );
      await rerender(<StreakDisplay days={7} last7={weekEndingToday(true)} />);
      expect(queryByText('6', hidden)).toBeNull();
      expect(queryByText('7')).toHaveStyle({ opacity: 1 });
    });

    test('reduce motion switched on mid-roll lands on the new number', async () => {
      const { queryByText, rerender } = await render(
        <StreakDisplay days={6} last7={weekEndingToday(false)} />
      );
      await rerender(<StreakDisplay days={7} last7={weekEndingToday(true)} />);
      await act(() => jest.advanceTimersByTime(60));

      mockReduceMotion = true;
      await rerender(<StreakDisplay days={7} last7={weekEndingToday(true)} />);
      expect(queryByText('6', hidden)).toBeNull();
      expect(queryByText('7')).toHaveStyle({
        opacity: 1,
        transform: [{ translateY: 0 }, { scale: 1 }],
      });
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
      expect(queryByText('6', hidden)).toBeNull();
      expect(queryByText('7')).toBeTruthy();
    });
  });
});

// The digits drawn fully opaque in a rendered tree, e.g. ['6'].
function numbersAtFullOpacity(tree: unknown): string[] {
  const found: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const n = node as { type: string; props: { style?: unknown }; children: unknown[] | null };
    const [only] = n.children ?? [];
    const isNumber = n.children?.length === 1 && typeof only === 'string' && /^\d+$/.test(only);
    if (n.type === 'Text' && isNumber) {
      const style = StyleSheet.flatten(n.props.style as never) as { opacity?: number } | undefined;
      if ((style?.opacity ?? 1) === 1) found.push(only);
    }
    (n.children ?? []).forEach(walk);
  };
  walk(tree);
  return found;
}
