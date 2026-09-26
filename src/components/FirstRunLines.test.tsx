import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

jest.mock('../theme/useColors', () => {
  const { lightColors } = require('../theme/colors');
  return { useColors: () => lightColors, useIsDark: () => false };
});

import { FirstDayLine, FirstRunDotsLine, PrivacyLine } from './FirstRunLines';

describe('FirstRunLines', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  // The dots are not screen-reader elements, so the line names them.
  test('the dot line is one element, read in words', async () => {
    await render(<FirstRunDotsLine />);
    const line = screen.getByTestId('first-run-dots');
    expect(line).toHaveAccessibleName('書いた日が、直近7日の点で埋まっていきます。');
    expect(screen.getByText('書いた日が、', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('この点で埋まっていきます。', { includeHiddenElements: true })).toBeTruthy();
  });

  test('the privacy line is read as one sentence, with no role', async () => {
    await render(<PrivacyLine leaving={false} />);
    const line = screen.getByTestId('first-run-privacy');
    expect(line).toHaveAccessibleName('記録は、この端末に保存されます。');
    expect(line.props.accessibilityRole).toBeUndefined();
  });

  test('the privacy line fades out when it leaves', async () => {
    const view = await render(<PrivacyLine leaving={false} />);
    expect(screen.getByTestId('first-run-privacy')).toHaveStyle({ opacity: 1 });
    await view.rerender(<PrivacyLine leaving />);
    await act(async () => jest.advanceTimersByTime(1000));
    await view.rerender(<PrivacyLine leaving />);
    expect(screen.getByTestId('first-run-privacy')).toHaveStyle({ opacity: 0 });
  });

  test('the first day line is read as one sentence; it fades in only when it enters', async () => {
    const view = await render(<FirstDayLine enter={false} />);
    expect(screen.getByTestId('first-day')).toHaveAccessibleName('1日目。明日も書くと、つながります。');
    expect(screen.getByTestId('first-day')).toHaveStyle({ opacity: 1 });

    await view.rerender(<></>);
    await view.rerender(<FirstDayLine enter />);
    expect(screen.getByTestId('first-day')).toHaveStyle({ opacity: 0 });
  });

  test('no line limits font scaling or cuts text off', async () => {
    await render(
      <>
        <FirstRunDotsLine />
        <PrivacyLine leaving={false} />
        <FirstDayLine enter={false} />
      </>
    );
    for (const t of screen.getAllByText(/./, { includeHiddenElements: true })) {
      expect(t.props.maxFontSizeMultiplier).toBeUndefined();
      expect(t.props.numberOfLines).toBeUndefined();
    }
  });
});
