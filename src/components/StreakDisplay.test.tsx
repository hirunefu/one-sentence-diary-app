import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('../theme/useColors', () => {
  const { lightColors } = require('../theme/colors');
  return {
    useColors: () => lightColors,
    useIsDark: () => false,
  };
});

import { StreakDisplay } from './StreakDisplay';

const allRecorded = (todayStr: string) => {
  return Array.from({ length: 7 }, (_, i) => ({
    date: `2026-04-${22 + i}`,
    recorded: true,
    isToday: i === 6,
  }));
};

describe('StreakDisplay', () => {
  test('shows the streak number', () => {
    const { getByText } = render(<StreakDisplay days={7} last7={allRecorded('2026-04-28')} />);
    expect(getByText('7')).toBeTruthy();
    expect(getByText('日連続')).toBeTruthy();
  });

  test('shows 0 when days=0', () => {
    const last7 = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${22 + i}`,
      recorded: false,
      isToday: i === 6,
    }));
    const { getByText } = render(<StreakDisplay days={0} last7={last7} />);
    expect(getByText('0')).toBeTruthy();
  });

  test('renders 7 dots with correct testIDs', () => {
    const { getByTestId } = render(<StreakDisplay days={7} last7={allRecorded('2026-04-28')} />);
    for (let i = 0; i < 7; i++) {
      expect(getByTestId(`streak-dot-${i}`)).toBeTruthy();
    }
  });

  test('shows the "直近7日" label', () => {
    const { getByText } = render(<StreakDisplay days={7} last7={allRecorded('2026-04-28')} />);
    expect(getByText('直近7日')).toBeTruthy();
  });

  test('renders dots even when streak is 0', () => {
    const last7 = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${22 + i}`,
      recorded: false,
      isToday: i === 6,
    }));
    const { getByTestId } = render(<StreakDisplay days={0} last7={last7} />);
    expect(getByTestId('streak-dot-6')).toBeTruthy();
  });
});
