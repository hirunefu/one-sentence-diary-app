import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('../theme/useColors', () => {
  const { lightColors } = require('../theme/colors');
  return { useColors: () => lightColors, useIsDark: () => false };
});

import { LongestStreakLine } from './LongestStreakLine';

describe('LongestStreakLine', () => {
  test('reads as one line, the way it is shown', async () => {
    await render(<LongestStreakLine days={21} />);
    expect(screen.getByTestId('history-longest-streak')).toHaveTextContent('最長記録 21日');
  });

  test('is not shown before the first Entry', async () => {
    await render(<LongestStreakLine days={0} />);
    expect(screen.queryByTestId('history-longest-streak')).toBeNull();
  });
});
