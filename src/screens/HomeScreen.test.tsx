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
let mockReduceMotion = true;
jest.mock('../hooks/useReduceMotion', () => ({ useReduceMotion: () => mockReduceMotion }));
const mockRemind = jest.fn(async () => {});
jest.mock('../hooks/useExportReminder', () => ({
  useExportReminder: () => ({ remindAfterSave: mockRemind }),
}));
let mockFocused = true;
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
  useNavigation: () => ({ navigate: mockNavigate }),
}));
let mockScreenReader = false;
jest.mock('../hooks/useScreenReaderEnabled', () => ({
  useScreenReaderEnabled: () => mockScreenReader,
}));
let mockKeyboard = false;
jest.mock('../hooks/useKeyboardShown', () => ({ useKeyboardShown: () => mockKeyboard }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import { EntriesProvider, useEntries } from '../contexts/EntriesContext';
import type { DiaryDatabase } from '../db/database';
import { openTestDatabase } from '../db/testDatabase';
import { upsertEntry } from '../repositories/entriesRepository';
import { AFTER_CLOSE_PAUSE_MS, revealDelayMs } from '../hooks/useCelebration';
import { ENTRANCE_MS } from '../components/CelebrationModal';
import { STREAK_IN_PLACE_MS } from '../components/StreakDisplay';
import { FADE_MS } from '../components/LongestTodayLine';
import { LayoutAnimation } from 'react-native';
import { addDays, today } from '../utils/date';
import { HomeScreen, SAVED_FEEDBACK_MS } from './HomeScreen';

beforeEach(async () => {
  mockDb = openTestDatabase();
  mockRemind.mockClear();
  mockNavigate.mockClear();
  mockFocused = true;
  mockScreenReader = false;
  mockKeyboard = false;
  mockReduceMotion = true;
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

  test('a new Longest streak alone is told in place and in the save announcement', async () => {
    // An earlier stretch of 10, a gap, and 10 days up to yesterday: today makes 11.
    await writeBeforeLaunch([
      ...Array.from({ length: 10 }, (_, i) => -13 - i),
      ...Array.from({ length: 10 }, (_, i) => -1 - i),
    ]);
    await openHome();
    await saveToday('eleventh day');

    expect(announce).toHaveBeenLastCalledWith(
      '保存しました。11日連続。いちばん長く続いています。これまでの最長記録は、10日でした。'
    );
    await wait(SAVED_FEEDBACK_MS);
    expect(screen.getByTestId('longest-today')).toBeTruthy();
    expect(screen.queryByTestId('celebration')).toBeNull();
    expect(mockRemind).toHaveBeenCalledTimes(1);
    // Announced once, with the save.
    expect(announce).toHaveBeenCalledTimes(1);
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

describe('HomeScreen Streak break and repair', () => {
  const yesterday = () => addDays(today(), -1);
  let entries: ReturnType<typeof useEntries>;
  function Capture() {
    entries = useEntries();
    return null;
  }
  const app = () => (
    <EntriesProvider>
      <HomeScreen />
      <Capture />
    </EntriesProvider>
  );
  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => -(from + i));

  let focus: jest.SpyInstance;
  let announce: jest.SpyInstance;
  beforeEach(() => {
    jest.useFakeTimers();
    focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
    announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
  });
  afterEach(() => {
    jest.useRealTimers();
    focus.mockRestore();
    announce.mockRestore();
  });

  const wait = (ms: number) => act(async () => jest.advanceTimersByTime(ms));
  const open = async () => {
    const view = await render(app());
    await screen.findByTestId('streak-first-row');
    return view;
  };
  // Writes yesterday the way the editor does, with Home covered meanwhile.
  const repairFromEditor = async (rerender: (ui: React.ReactElement) => Promise<void>) => {
    await fireEvent.press(screen.getByTestId('streak-repair-write'));
    mockFocused = false;
    await act(async () => entries.upsert(yesterday(), 'yesterday'));
    mockFocused = true;
    await rerender(app());
  };

  test('says nothing about a break before the first Entry', async () => {
    await open();
    expect(screen.getByTestId('streak-number')).toHaveTextContent('0');
    expect(screen.queryByTestId('streak-restart')).toBeNull();
    expect(screen.queryByTestId('streak-repair')).toBeNull();
  });

  test('two missing days: 「また今日から」, with no 0 and no offer', async () => {
    await writeBeforeLaunch([-3, -4]);
    await open();
    expect(screen.getByTestId('streak-restart')).toHaveTextContent('また今日から');
    expect(screen.queryByTestId('streak-number')).toBeNull();
    expect(screen.queryByTestId('streak-repair')).toBeNull();
    expect(announce).not.toHaveBeenCalled();
  });

  test('only yesterday missing: the offer, and no number', async () => {
    await writeBeforeLaunch([-2, -3]);
    await open();
    expect(screen.getByLabelText('昨日の分を書けば、3日連続になります。')).toBeTruthy();
    expect(screen.queryByTestId('streak-number')).toBeNull();
    expect(announce).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  test('with today written, the offer counts today too', async () => {
    await writeBeforeLaunch([0, -2, -3]);
    await open();
    expect(screen.getByTestId('streak-number')).toHaveTextContent('1');
    expect(screen.getByLabelText('昨日の分を書けば、4日連続になります。')).toBeTruthy();
  });

  test('昨日の分を書く opens the editor on yesterday', async () => {
    await writeBeforeLaunch([-2, -3]);
    await open();
    await fireEvent.press(screen.getByTestId('streak-repair-write'));
    expect(mockNavigate).toHaveBeenCalledWith('EntryEditor', { date: yesterday() });
  });

  test('writing yesterday brings the Streak back in place and moves focus to it', async () => {
    mockScreenReader = true;
    await writeBeforeLaunch(range(2, 5));
    const { rerender } = await open();
    await repairFromEditor(rerender);
    expect(screen.queryByTestId('streak-repair')).toBeNull();
    expect(screen.getByTestId('streak-number')).toHaveTextContent('5');
    expect(focus).not.toHaveBeenCalled();
    await wait(STREAK_IN_PLACE_MS);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus.mock.calls[0]![0].props.accessibilityLabel).toMatch(/^5日連続。/);
    // The seed remembered the stretch before the gap: no late Milestone.
    await wait(revealDelayMs({ reduceMotion: true, screenReader: true }));
    expect(screen.queryByTestId('celebration')).toBeNull();
  });

  test('a repair that reaches a Milestone leaves the telling to the full screen', async () => {
    mockScreenReader = true;
    await writeBeforeLaunch(range(2, 7));
    const { rerender } = await open();
    await repairFromEditor(rerender);
    await wait(STREAK_IN_PLACE_MS);
    expect(focus).not.toHaveBeenCalled();
    await wait(revealDelayMs({ reduceMotion: true, screenReader: true }));
    expect(screen.getByTestId('celebration-number')).toHaveTextContent('7');
  });

  test('a repair that makes a new Longest streak alone focuses its line, unannounced', async () => {
    mockScreenReader = true;
    await writeBeforeLaunch([...range(2, 9), ...range(13, 20)]);
    const { rerender } = await open();
    await repairFromEditor(rerender);
    await wait(STREAK_IN_PLACE_MS + 100);
    expect(screen.getByTestId('longest-today')).toBeTruthy();
    // Focus follows once the line has faded in, not while it is transparent.
    await wait(FADE_MS - 20);
    expect(focus).not.toHaveBeenCalled();
    await wait(20);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus.mock.calls[0]![0].props.testID).toBe('longest-today');
    expect(announce).not.toHaveBeenCalled();
  });

  test('閉じる declines the offer for this missing day, also after a relaunch', async () => {
    await writeBeforeLaunch([-2, -3]);
    const { unmount } = await open();
    await fireEvent.press(screen.getByTestId('streak-repair-close'));
    expect(screen.queryByTestId('streak-repair')).toBeNull();
    expect(screen.getByTestId('streak-restart')).toBeTruthy();
    await unmount();

    await open();
    expect(screen.queryByTestId('streak-repair')).toBeNull();
    expect(screen.getByTestId('streak-restart')).toBeTruthy();
  });

  test('閉じる takes TalkBack to the Streak, now 「また今日から」', async () => {
    mockScreenReader = true;
    await writeBeforeLaunch([-2, -3]);
    await open();
    await fireEvent.press(screen.getByTestId('streak-repair-close'));
    await wait(50);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus.mock.calls[0]![0].props.accessibilityLabel).toMatch(/^また今日から。/);
  });

  test('saving today from 「また今日から」 lets the number rise without a layout animation', async () => {
    mockReduceMotion = false;
    await writeBeforeLaunch([-3, -4]);
    await open();
    const layout = jest.spyOn(LayoutAnimation, 'configureNext');
    await fireEvent.changeText(screen.getByTestId('entry-input'), 'back again');
    await fireEvent.press(screen.getByTestId('save-button'));
    await waitFor(() => expect(screen.getByTestId('streak-number')).toHaveTextContent('1'));
    expect(layout).not.toHaveBeenCalled();
    layout.mockRestore();
  });

  test("deleting yesterday's Entry does not ask for it back", async () => {
    await writeBeforeLaunch([-1, -2, -3]);
    await open();
    await act(async () => entries.remove(yesterday()));
    expect(screen.queryByTestId('streak-repair')).toBeNull();
    expect(screen.getByTestId('streak-restart')).toBeTruthy();
  });

  test('the offer steps aside while the keyboard is up', async () => {
    mockKeyboard = true;
    await writeBeforeLaunch([-2, -3]);
    const { rerender } = await open();
    expect(screen.queryByTestId('streak-repair')).toBeNull();
    mockKeyboard = false;
    await rerender(app());
    expect(screen.getByTestId('streak-repair')).toBeTruthy();
  });
});
