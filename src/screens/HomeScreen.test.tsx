import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Run the real Entries provider against the in-memory better-sqlite3 database.
jest.mock('../db/database', () => ({
  openDatabase: () => require('../db/testDatabase').openTestDatabase(),
}));
jest.mock('../theme/useColors', () => {
  const { lightColors } = require('../theme/colors');
  return { useColors: () => lightColors, useIsDark: () => false };
});
jest.mock('../hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('../hooks/useExportReminder', () => ({
  useExportReminder: () => ({ remindAfterSave: jest.fn(async () => {}) }),
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import { EntriesProvider } from '../contexts/EntriesContext';
import { HomeScreen } from './HomeScreen';

describe('HomeScreen save announcement', () => {
  let announce: jest.SpyInstance;
  beforeEach(() => {
    announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
  });
  afterEach(() => announce.mockRestore());

  const save = async (text: string) => {
    await fireEvent.changeText(await screen.findByTestId('entry-input'), text);
    await fireEvent.press(screen.getByTestId('save-button'));
  };

  test('tells screen reader users when the save grew the Streak, and not when it did not', async () => {
    await render(
      <EntriesProvider>
        <HomeScreen />
      </EntriesProvider>
    );

    await save('Walked by the river');
    await waitFor(() => expect(announce).toHaveBeenLastCalledWith('保存しました。1日連続'));

    // Editing today's Entry again keeps the Streak where it was.
    await save('Walked by the river after work');
    await waitFor(() => expect(announce).toHaveBeenLastCalledWith('保存しました'));
    expect(announce).toHaveBeenCalledTimes(2);
  });
});
