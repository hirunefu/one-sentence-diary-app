import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('../theme/useColors', () => {
  const { lightColors } = require('../theme/colors');
  return { useColors: () => lightColors, useIsDark: () => false };
});

import { ReminderOffer, ReminderSetLine } from './ReminderOffer';
import { reminderOfferLine, reminderSetCopy } from '../services/firstRunCopy';

describe('ReminderOffer', () => {
  const offer = (asking = false, onDecline = jest.fn(), onAccept = jest.fn()) => (
    <ReminderOffer line={reminderOfferLine(21, 0)} asking={asking} onDecline={onDecline} onAccept={onAccept} />
  );

  test('reads the question, then いらない, then 設定する', async () => {
    await render(offer());
    const names = screen
      .getAllByRole(/.*/, { includeHiddenElements: false })
      .filter((n) => n.props.accessible)
      .map((n) => n.props.accessibilityLabel);
    expect(names).toEqual(['記録のない日は、21時にお知らせしましょうか？', 'いらない', '設定する']);
  });

  test('both buttons are 48dp targets that say what they do', async () => {
    await render(offer());
    const decline = screen.getByTestId('reminder-offer-decline');
    const accept = screen.getByTestId('reminder-offer-accept');
    for (const b of [decline, accept]) expect(b).toHaveStyle({ minHeight: 48, minWidth: 48 });
    expect(decline.props.accessibilityHint).toBe('リマインダーはオフのまま、この案内を閉じます');
    expect(accept.props.accessibilityHint).toBe(
      'リマインダーをオンにします。通知の許可を求める画面が開くことがあります'
    );
  });

  test('each button does its own thing', async () => {
    const onDecline = jest.fn();
    const onAccept = jest.fn();
    await render(offer(false, onDecline, onAccept));
    await fireEvent.press(screen.getByTestId('reminder-offer-decline'));
    expect(onDecline).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('reminder-offer-accept'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  test('while asking, the card stays and both buttons are disabled', async () => {
    const onDecline = jest.fn();
    const onAccept = jest.fn();
    await render(offer(true, onDecline, onAccept));
    expect(screen.getByTestId('reminder-offer')).toBeTruthy();
    for (const id of ['reminder-offer-decline', 'reminder-offer-accept']) {
      expect(screen.getByTestId(id)).toBeDisabled();
      await fireEvent.press(screen.getByTestId(id));
    }
    expect(onDecline).not.toHaveBeenCalled();
    expect(onAccept).not.toHaveBeenCalled();
  });
});

describe('ReminderSetLine', () => {
  test('says what was set and where to change it, read as one', async () => {
    await render(<ReminderSetLine copy={reminderSetCopy(7, 30)} />);
    expect(screen.getByTestId('reminder-set')).toHaveAccessibleName(
      '記録のない日は、7時30分にお知らせします。時刻は、設定で変えられます。'
    );
  });
});
