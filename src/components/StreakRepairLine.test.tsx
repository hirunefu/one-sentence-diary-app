import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('../theme/useColors', () => {
  const { lightColors } = require('../theme/colors');
  return { useColors: () => lightColors, useIsDark: () => false };
});
jest.mock('../hooks/useReduceMotion', () => ({ useReduceMotion: () => false }));

import { StreakRepairLine } from './StreakRepairLine';

describe('StreakRepairLine', () => {
  const show = async () => {
    const onWrite = jest.fn();
    const onClose = jest.fn();
    await render(<StreakRepairLine streakAfter={13} onWrite={onWrite} onClose={onClose} />);
    return { onWrite, onClose };
  };

  test('says what writing yesterday gives, read as one sentence', async () => {
    await show();
    expect(screen.getByLabelText('昨日の分を書けば、13日連続になります。')).toBeTruthy();
    expect(screen.getByText('昨日の分を書けば、')).toBeTruthy();
    expect(screen.getByText('13日連続になります。')).toBeTruthy();
  });

  test('offers two buttons, named as shown, 閉じる first', async () => {
    await show();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.props.accessibilityLabel)).toEqual(['閉じる', '昨日の分を書く']);
    expect(screen.getByRole('button', { name: '閉じる' }).props.accessibilityHint).toBe(
      'この案内を閉じます'
    );
  });

  test('each button is a 48dp target', async () => {
    await show();
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveStyle({ minHeight: 48, minWidth: 48 });
    }
  });

  test('the buttons close the offer or open yesterday', async () => {
    const { onWrite, onClose } = await show();
    await fireEvent.press(screen.getByRole('button', { name: '昨日の分を書く' }));
    expect(onWrite).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: '閉じる' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
