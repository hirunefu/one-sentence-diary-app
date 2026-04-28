import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('../theme/useColors', () => {
  const { lightColors } = require('../theme/colors');
  return {
    useColors: () => lightColors,
    useIsDark: () => false,
  };
});

import { StreakBadge } from './StreakBadge';

describe('StreakBadge', () => {
  test('shows 0-day message for 0', () => {
    const { getByText } = render(<StreakBadge days={0} />);
    expect(getByText('まだ記録がありません')).toBeTruthy();
  });

  test('shows 1-day message for 1', () => {
    const { getByText } = render(<StreakBadge days={1} />);
    expect(getByText('🔥 1日連続')).toBeTruthy();
  });

  test('shows N-day message for N>=2', () => {
    const { getByText } = render(<StreakBadge days={7} />);
    expect(getByText('🔥 7日連続')).toBeTruthy();
  });
});
