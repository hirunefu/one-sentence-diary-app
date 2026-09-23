import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

jest.mock('../theme/useColors', () => {
  const { lightColors } = require('../theme/colors');
  return { useColors: () => lightColors, useIsDark: () => false };
});

import { LongestTodayLine } from './LongestTodayLine';

describe('LongestTodayLine', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('tells the new Longest streak in two short sentences, read as one', async () => {
    await render(<LongestTodayLine previousLongest={10} />);
    expect(
      screen.getByLabelText('いちばん長く続いています。これまでの最長記録は、10日でした。')
    ).toBeTruthy();
    expect(screen.getByText('いちばん長く続いています。')).toBeTruthy();
    expect(screen.getByText('これまでの最長記録は、')).toBeTruthy();
    expect(screen.getByText('10日でした。')).toBeTruthy();
  });

  test('fades in, then stays', async () => {
    const { rerender } = await render(<LongestTodayLine previousLongest={10} />);
    await act(async () => jest.advanceTimersByTime(1000));
    // A re-render draws from the JS value, which is pinned once the fade ends.
    await rerender(<LongestTodayLine previousLongest={10} />);
    expect(screen.getByTestId('longest-today')).toHaveStyle({ opacity: 1 });
    await act(async () => jest.advanceTimersByTime(60_000));
    expect(screen.getByTestId('longest-today')).toBeTruthy();
  });
});
