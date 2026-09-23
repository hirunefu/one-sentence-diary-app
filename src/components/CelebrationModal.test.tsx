import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('../theme/useColors', () => {
  const { lightColors } = require('../theme/colors');
  return { useColors: () => lightColors, useIsDark: () => false };
});
let mockReduceMotion = false;
jest.mock('../hooks/useReduceMotion', () => ({ useReduceMotion: () => mockReduceMotion }));

import { CelebrationModal, ENTRANCE_MS, EXIT_MS } from './CelebrationModal';
import type { Celebration } from '../services/celebration';

const seven: Celebration = {
  stretchStart: '2026-05-09',
  streak: 7,
  milestone: 7,
  previousLongest: null,
};

async function show(celebration: Celebration | null = seven) {
  const onSettled = jest.fn();
  const onClose = jest.fn();
  const view = await render(
    <CelebrationModal celebration={celebration} onSettled={onSettled} onClose={onClose} />
  );
  return { ...view, onSettled, onClose };
}

const wait = (ms: number) => act(async () => jest.advanceTimersByTime(ms));

describe('CelebrationModal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReduceMotion = false;
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('shows nothing without a celebration', async () => {
    await show(null);
    expect(screen.queryByTestId('celebration')).toBeNull();
  });

  test('tells the Streak, the Milestone and a quiet line, read as one message', async () => {
    await show();
    expect(screen.getByTestId('celebration-number')).toHaveTextContent('7');
    expect(screen.getByText('日連続')).toBeTruthy();
    expect(screen.getByText('1週間、続きました。')).toBeTruthy();
    expect(
      screen.getByLabelText('7日連続。1週間、続きました。毎日の一文が、ここに残っています。')
    ).toBeTruthy();
  });

  test('a new Longest streak on the same day is one more line', async () => {
    await show({ ...seven, streak: 14, milestone: 14, previousLongest: 13 });
    expect(screen.getByText('これまでの最長記録（13日）を超えました。')).toBeTruthy();
  });

  test('comes to rest once, after the entrance', async () => {
    const { onSettled } = await show();
    await wait(500);
    expect(onSettled).not.toHaveBeenCalled();
    await wait(ENTRANCE_MS + 1000);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  test('with reduce motion, the first frame is the end state', async () => {
    mockReduceMotion = true;
    const { onSettled } = await show();
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('celebration-number')).toHaveStyle({ opacity: 1 });
    expect(screen.getByTestId('celebration')).toHaveStyle({ opacity: 1 });
  });

  test('reduce motion turned on during the entrance lands on the end state', async () => {
    const { onSettled, rerender, onClose } = await show();
    await wait(100);
    mockReduceMotion = true;
    await rerender(
      <CelebrationModal celebration={seven} onSettled={onSettled} onClose={onClose} />
    );
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('celebration-number')).toHaveStyle({ opacity: 1 });
  });

  test('閉じる closes it once, after the exit', async () => {
    const { onClose } = await show();
    await wait(ENTRANCE_MS + 500);
    await fireEvent.press(screen.getByTestId('celebration-close'));
    await fireEvent.press(screen.getByTestId('celebration-close'));
    expect(onClose).not.toHaveBeenCalled();
    await wait(EXIT_MS + 50);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('closed during the entrance, it fades out without coming to rest', async () => {
    const { onSettled, onClose } = await show();
    await wait(100);
    await fireEvent.press(screen.getByTestId('celebration-close'));
    await wait(ENTRANCE_MS + 1000);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSettled).not.toHaveBeenCalled();
  });

  test('Back closes it too, straight away with reduce motion', async () => {
    mockReduceMotion = true;
    const { onClose } = await show();
    await fireEvent(screen.getByTestId('celebration'), 'requestClose');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('moves screen-reader focus to the message, without announcing it too', async () => {
    const focus = jest
      .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      .mockImplementation(() => {});
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await show();
    await fireEvent(screen.getByTestId('celebration'), 'show');
    await wait(50);
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
    expect(announce).not.toHaveBeenCalled();
  });
});
