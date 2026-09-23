import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Run the real Entries provider against the in-memory better-sqlite3 database,
// one per test, so Entries can be written before Home opens.
let mockDb: Promise<DiaryDatabase>;
jest.mock('../db/database', () => ({ openDatabase: () => mockDb }));
jest.mock('../theme/useColors', () => {
  const { lightColors } = require('../theme/colors');
  return { useColors: () => lightColors, useIsDark: () => false };
});
jest.mock('../hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));
const mockRemind = jest.fn(async () => {});
jest.mock('../hooks/useExportReminder', () => ({
  useExportReminder: () => ({ remindAfterSave: mockRemind }),
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import { EntriesProvider } from '../contexts/EntriesContext';
import type { DiaryDatabase } from '../db/database';
import { openTestDatabase } from '../db/testDatabase';
import { upsertEntry } from '../repositories/entriesRepository';
import { AFTER_CLOSE_PAUSE_MS, revealDelayMs } from '../hooks/useCelebration';
import { ENTRANCE_MS } from '../components/CelebrationModal';
import { addDays, today } from '../utils/date';
import { HomeScreen, SAVED_FEEDBACK_MS } from './HomeScreen';

beforeEach(async () => {
  mockDb = openTestDatabase();
  mockRemind.mockClear();
  await AsyncStorage.clear();
});

async function writeBeforeLaunch(offsets: number[]) {
  const db = await mockDb;
  for (const offset of offsets) {
    await upsertEntry(db, { date: addDays(today(), offset), text: 'before', now: 1 });
  }
}

const openHome = () =>
  render(
    <EntriesProvider>
      <HomeScreen />
    </EntriesProvider>
  );

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

  test('tells screen reader users when the save grew the Streak, and not otherwise', async () => {
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

describe('HomeScreen Milestone celebration', () => {
  let announce: jest.SpyInstance;
  beforeEach(() => {
    jest.useFakeTimers();
    announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
  });
  afterEach(() => {
    jest.useRealTimers();
    announce.mockRestore();
  });

  const wait = (ms: number) => act(async () => jest.advanceTimersByTime(ms));
  // This file runs with reduce motion on.
  const reveal = revealDelayMs({ reduceMotion: true, screenReader: false });

  async function saveToday(text: string) {
    await fireEvent.changeText(await screen.findByTestId('entry-input'), text);
    await fireEvent.press(screen.getByTestId('save-button'));
    await waitFor(() => expect(announce).toHaveBeenCalled());
  }

  test('saving the day that makes 3 shows the celebration and leaves the count to it', async () => {
    await writeBeforeLaunch([-1, -2]);
    await openHome();
    await saveToday('third day');

    expect(announce).toHaveBeenLastCalledWith('保存しました');
    expect(screen.queryByTestId('celebration')).toBeNull();
    await wait(reveal);
    expect(screen.getByTestId('celebration-number')).toHaveTextContent('3');
    expect(screen.getByText('3日、続きました。')).toBeTruthy();
  });

  test('the backup reminder waits until the celebration is closed', async () => {
    await writeBeforeLaunch([-1, -2]);
    await openHome();
    await saveToday('third day');
    await wait(SAVED_FEEDBACK_MS + 1000);
    // Once it has come to rest, 閉じる takes the press.
    await wait(ENTRANCE_MS);
    expect(mockRemind).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('celebration-close'));
    await wait(AFTER_CLOSE_PAUSE_MS);
    expect(screen.queryByTestId('celebration')).toBeNull();
    expect(mockRemind).toHaveBeenCalledTimes(1);
  });

  test('a save that reaches no Milestone reminds after the saved feedback, as before', async () => {
    await writeBeforeLaunch([-1]);
    await openHome();
    await saveToday('second day');
    await wait(SAVED_FEEDBACK_MS);
    expect(mockRemind).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('celebration')).toBeNull();
  });

  // The E2E flows check that no celebration appeared once the saved feedback
  // is over, which only holds while it comes first.
  test.each([
    [false, false],
    [true, false],
    [false, true],
  ])('appears before the saved feedback ends (reduce motion %p, screen reader %p)', (r, s) => {
    expect(revealDelayMs({ reduceMotion: r, screenReader: s })).toBeLessThan(SAVED_FEEDBACK_MS);
  });
});
