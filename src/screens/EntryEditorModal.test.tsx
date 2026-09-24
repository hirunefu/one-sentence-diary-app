import React from 'react';
import { Alert, type AlertButton } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

let mockDb: Promise<DiaryDatabase>;
jest.mock('../db/database', () => ({ openDatabase: () => mockDb }));
jest.mock('../theme/useColors', () => {
  const { lightColors } = require('../theme/colors');
  return { useColors: () => lightColors, useIsDark: () => false };
});
jest.mock('../hooks/useExportReminder', () => ({
  useExportReminder: () => ({ remindAfterSave: jest.fn(async () => {}) }),
}));

import { EntriesProvider } from '../contexts/EntriesContext';
import type { DiaryDatabase } from '../db/database';
import { openTestDatabase } from '../db/testDatabase';
import { upsertEntry } from '../repositories/entriesRepository';
import { addDays, toJpDate, today } from '../utils/date';
import { EntryEditorModal } from './EntryEditorModal';

describe('EntryEditorModal', () => {
  const day = () => addDays(today(), -1);
  const open = () =>
    render(
      <EntriesProvider>
        <EntryEditorModal
          route={{ key: 'editor', name: 'EntryEditor', params: { date: day() } } as never}
          navigation={{ goBack: jest.fn() } as never}
        />
      </EntriesProvider>
    );

  beforeEach(async () => {
    mockDb = openTestDatabase();
    const db = await mockDb;
    await upsertEntry(db, { date: day(), text: 'written', now: 1 });
  });
  afterEach(() => jest.restoreAllMocks());

  test("asks for that day's sentence, not today's", async () => {
    await open();
    const input = await screen.findByTestId('entry-input');
    const d = new Date(`${day()}T00:00:00`);
    expect(input.props.placeholder).toBe(`${d.getMonth() + 1}月${d.getDate()}日の一文を書く`);
    expect(screen.queryByText('今日の一文')).toBeNull();
  });

  // TalkBack reads an EditText's contentDescription instead of what is
  // written in it, so the field is named by a label on screen.
  test('the field is named by a visible label for that day', async () => {
    await open();
    const input = await screen.findByTestId('entry-input');
    const d = new Date(`${day()}T00:00:00`);
    const name = `${d.getMonth() + 1}月${d.getDate()}日の一文`;
    expect(screen.getByText(name)).toBeVisible();
    expect(input).toHaveAccessibleName(name);
    expect(input.props.accessibilityLabel).toBeUndefined();
  });

  test('names the day as a date, not as digits', async () => {
    await open();
    expect(await screen.findByText(toJpDate(day()))).toBeTruthy();
  });

  test('the delete confirmation names the day and the undo, not the Streak', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await open();
    await fireEvent.press(await screen.findByTestId('editor-delete'));

    const [title, message, buttons] = alert.mock.calls[0] as [string, string, AlertButton[]];
    expect(title).toBe(`${toJpDate(day())}の記録を削除しますか？`);
    expect(message).toBe('削除は取り消せません。');
    expect(buttons.map((b) => [b.text, b.style])).toEqual([
      ['キャンセル', 'cancel'],
      ['削除', 'destructive'],
    ]);
    expect(`${title}${message}`).not.toMatch(/連続|最長|後から|取り戻/);
  });
});
