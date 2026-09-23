import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

// Icons are decorative here; the font loader behind them doesn't run in jest.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('../theme/useColors', () => {
  const { lightColors } = jest.requireActual('../theme/colors');
  return { useColors: () => lightColors };
});

import { CalendarHeader } from './CalendarHeader';

// The calendar passes an XDate; the header only needs year and month.
const month = (y: number, m: number) => ({ getFullYear: () => y, getMonth: () => m - 1 });

describe('CalendarHeader', () => {
  test('shows the month as a heading', async () => {
    const { getByRole } = await render(
      <CalendarHeader month={month(2026, 9)} addMonth={() => {}} todayStr="2026-09-23" />
    );
    expect(getByRole('header', { name: '2026年9月' })).toBeTruthy();
  });

  test('cannot move past the month that contains today', async () => {
    const addMonth = jest.fn();
    const { getByLabelText } = await render(
      <CalendarHeader month={month(2026, 9)} addMonth={addMonth} todayStr="2026-09-23" />
    );
    const next = getByLabelText('次の月');
    expect(next.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    await fireEvent.press(next);
    expect(addMonth).not.toHaveBeenCalled();

    await fireEvent.press(getByLabelText('前の月'));
    expect(addMonth).toHaveBeenCalledWith(-1);
  });

  test('can move forward from an earlier month, including across a year', async () => {
    const addMonth = jest.fn();
    const { getByLabelText } = await render(
      <CalendarHeader month={month(2025, 12)} addMonth={addMonth} todayStr="2026-01-05" />
    );
    await fireEvent.press(getByLabelText('次の月'));
    expect(addMonth).toHaveBeenCalledWith(1);
  });
});
