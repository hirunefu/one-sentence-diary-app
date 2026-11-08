import React from 'react';
import { AccessibilityInfo, Alert, AppState } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Home for a first-time user (step 7, ADR 0002), with the real Entries and
// Settings providers over an in-memory database.
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
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
  useNavigation: () => ({ navigate: jest.fn() }),
}));
let mockScreenReader = false;
jest.mock('../hooks/useScreenReaderEnabled', () => ({
  useScreenReaderEnabled: () => mockScreenReader,
}));
let mockKeyboard = false;
jest.mock('../hooks/useKeyboardShown', () => ({ useKeyboardShown: () => mockKeyboard }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
let mockRequest: () => Promise<boolean>;
let mockPermission: 'granted' | 'askable' | 'blocked';
jest.mock('../services/notifications', () => ({
  requestNotificationPermission: () => mockRequest(),
  notificationPermission: async () => mockPermission,
}));

import { EntriesProvider, useEntries } from '../contexts/EntriesContext';
import { SettingsProvider, useSettings } from '../contexts/SettingsContext';
import type { DiaryDatabase } from '../db/database';
import { openTestDatabase } from '../db/testDatabase';
import { upsertEntry } from '../repositories/entriesRepository';
import { loadFirstRun, saveFirstRun, type FirstRun } from '../repositories/firstRunRepository';
import { loadSettings, saveSettings } from '../repositories/settingsRepository';
import { classifyEntries } from '../services/importService';
import { DEFAULT_SETTINGS, type Settings } from '../types';
import { STREAK_IN_PLACE_MS } from '../components/StreakDisplay';
import { FADE_MS } from '../components/LongestTodayLine';
import { ENTRANCE_MS } from '../components/CelebrationModal';
import { AFTER_CLOSE_PAUSE_MS, revealDelayMs } from '../hooks/useCelebration';
import { addDays, today } from '../utils/date';
import { HomeScreen, SAVED_FEEDBACK_MS } from './HomeScreen';

let entries: ReturnType<typeof useEntries>;
let settings: ReturnType<typeof useSettings>;
function Capture() {
  entries = useEntries();
  settings = useSettings();
  return null;
}
const app = () => (
  <SettingsProvider>
    <EntriesProvider>
      <HomeScreen />
      <Capture />
    </EntriesProvider>
  </SettingsProvider>
);

// Every listener to the app's foreground state, to play Android's permission
// screen (the app goes to the background and comes back).
let appStateListeners: Array<(state: string) => void> = [];
const emitAppState = (state: string) =>
  act(async () => appStateListeners.slice().forEach((l) => l(state)));

let announce: jest.SpyInstance;
let focus: jest.SpyInstance;
let alert: jest.SpyInstance;
beforeEach(async () => {
  mockDb = openTestDatabase();
  await AsyncStorage.clear();
  mockRemind.mockClear();
  mockFocused = true;
  mockScreenReader = false;
  mockKeyboard = false;
  mockReduceMotion = true;
  mockPermission = 'askable';
  mockRequest = async () => true;
  appStateListeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, l: (s: string) => void) => {
    appStateListeners.push(l);
    return { remove: () => (appStateListeners = appStateListeners.filter((x) => x !== l)) };
  }) as never);
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  for (const spy of [announce, focus, alert]) spy.mockClear();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const wait = (ms: number) => act(async () => jest.advanceTimersByTime(ms));
// Lets the database and storage promises settle without moving the clock.
const flush = () =>
  act(async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  });
async function open() {
  const view = await render(app());
  await flush();
  await screen.findByTestId('streak-first-row');
  await flush();
  return view;
}
async function relaunch(view: Awaited<ReturnType<typeof render>>) {
  await view.unmount();
  return open();
}
async function save(text = 'first') {
  await fireEvent.changeText(screen.getByTestId('entry-input'), text);
  await fireEvent.press(screen.getByTestId('save-button'));
  await flush();
}
// Entries for those days, written today (a first-time user's Backfill) unless
// `writtenDaysAgo` says they were written on an earlier day.
async function writeBeforeLaunch(offsets: number[], writtenDaysAgo = 0) {
  const db = await mockDb;
  const d = new Date();
  const now = new Date(d.getFullYear(), d.getMonth(), d.getDate() - writtenDaysAgo, 12).getTime();
  for (const offset of offsets) {
    await upsertEntry(db, { date: addDays(today(), offset), text: 'before', now });
  }
}
const seedFirstRun = (state: FirstRun) => saveFirstRun(state);
const seedSettings = (partial: Partial<Settings>) => saveSettings({ ...DEFAULT_SETTINGS, ...partial });
const shown = (id: string) => screen.queryByTestId(id) !== null;
const layout = (height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 324, height } } });

describe('HomeScreen first run', () => {
  test('before the first Entry, explains the dots under them and says where Entries are kept', async () => {
    await open();
    expect(screen.getByTestId('first-run-dots')).toHaveAccessibleName(
      '書いた日が、直近7日の点で埋まっていきます。'
    );
    expect(screen.getByTestId('first-run-privacy')).toHaveAccessibleName('記録は、この端末に保存されます。');
    expect(shown('first-day')).toBe(false);
    expect(shown('reminder-offer')).toBe(false);
  });

  test('the first-run lines step aside while the keyboard is up', async () => {
    const view = await open();
    mockKeyboard = true;
    await view.rerender(app());
    expect(shown('first-run-dots')).toBe(false);
    expect(shown('first-run-privacy')).toBe(false);
    mockKeyboard = false;
    await view.rerender(app());
    expect(shown('first-run-dots')).toBe(true);
  });

  test('a returning user never sees any of it, also after deleting every Entry', async () => {
    await writeBeforeLaunch([-3]);
    await open();
    expect(shown('first-run-dots')).toBe(false);
    expect(shown('first-run-privacy')).toBe(false);
    await act(async () => entries.remove(addDays(today(), -3)));
    await save();
    await wait(SAVED_FEEDBACK_MS);
    for (const id of ['first-run-dots', 'first-run-privacy', 'first-day', 'reminder-offer']) {
      expect(shown(id)).toBe(false);
    }
  });

  test('the first save is announced with the first day line', async () => {
    await open();
    await save();
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenLastCalledWith('保存しました。1日目。明日も書くと、つながります。');
  });

  test('the privacy line leaves with the save; 「1日目」 takes the dot line\'s place once the number has settled', async () => {
    mockReduceMotion = false;
    await open();
    await save();
    // It fades rather than vanishing.
    expect(shown('first-run-privacy')).toBe(true);
    expect(shown('first-run-dots')).toBe(true);
    await wait(FADE_MS);
    expect(shown('first-run-privacy')).toBe(false);
    await wait(STREAK_IN_PLACE_MS - FADE_MS - 1);
    expect(shown('first-run-dots')).toBe(true);
    expect(shown('first-day')).toBe(false);
    await wait(1);
    expect(shown('first-run-dots')).toBe(false);
    expect(screen.getByTestId('first-day')).toHaveAccessibleName('1日目。明日も書くと、つながります。');
  });

  test('with reduce motion, 「1日目」 comes without waiting', async () => {
    await open();
    await save();
    await wait(0);
    expect(shown('first-day')).toBe(true);
    expect(shown('first-run-dots')).toBe(false);
  });

  test('「1日目」 stays for the rest of the day, also after a relaunch, and goes at midnight', async () => {
    jest.setSystemTime(new Date(2026, 8, 26, 20, 0, 0));
    const view = await open();
    await save();
    await wait(SAVED_FEEDBACK_MS);
    await relaunch(view);
    expect(shown('first-day')).toBe(true);

    await wait(4 * 60 * 60 * 1000);
    expect(shown('first-day')).toBe(false);
    expect(shown('reminder-offer')).toBe(false);
    expect(await loadFirstRun()).toEqual({ kind: 'returning' });
  });

  test("「1日目」 goes when today's Entry is deleted, and the first-run lines come back", async () => {
    await open();
    await save();
    await wait(SAVED_FEEDBACK_MS);
    await act(async () => entries.remove(today()));
    await flush();
    expect(shown('first-day')).toBe(false);
    expect(shown('first-run-dots')).toBe(true);
    expect(shown('first-run-privacy')).toBe(true);
  });

  test('a Backfill as the first Entry shows no 「1日目」; the Home save after it opens the offer', async () => {
    await open();
    await act(async () => entries.upsert(addDays(today(), -1), 'yesterday'));
    await flush();
    expect(shown('first-run-dots')).toBe(false);
    expect(shown('first-day')).toBe(false);
    expect(await loadFirstRun()).toEqual({ kind: 'new' });

    // Yesterday is written, so today continues it: no 「1日目」.
    await save('today');
    await wait(SAVED_FEEDBACK_MS);
    expect(shown('first-day')).toBe(false);
    expect(shown('reminder-offer')).toBe(true);
  });

  test('an import as the first Entries shows no first-run content', async () => {
    await open();
    const restored = [{ date: addDays(today(), -2), text: 'restored', createdAt: 1, updatedAt: 1 }];
    await act(async () => {
      await entries.bulkImport(classifyEntries(restored, new Set(), today()), 'skip');
    });
    await save();
    await wait(SAVED_FEEDBACK_MS);
    for (const id of ['first-run-dots', 'first-run-privacy', 'first-day', 'reminder-offer']) {
      expect(shown(id)).toBe(false);
    }
  });

  // A small phone at a large font size.
  test('where the field has too little room, the dot line gives way to the privacy line', async () => {
    await open();
    await fireEvent(screen.getByTestId('first-run-dots-item'), 'layout', layout(66));
    await fireEvent(screen.getByTestId('first-run-privacy-item'), 'layout', layout(66));
    const hidden = { includeHiddenElements: true };
    await fireEvent(screen.getByTestId('entry-label-row', hidden), 'layout', layout(30));
    await fireEvent(screen.getByTestId('entry-prompt', hidden), 'layout', layout(110));
    await fireEvent(screen.getByTestId('entry-line-sizer', hidden), 'layout', layout(45));
    // Body and dot line together: 216dp. The field needs 30 + 6 + 110, which
    // leaves 70: the privacy line fits, the dot line does not.
    await fireEvent(screen.getByTestId('home-body'), 'layout', layout(216 - 66));
    await flush();
    expect(shown('first-run-privacy')).toBe(true);
    expect(shown('first-run-dots')).toBe(false);

    // It does not come back when the body grows into its place.
    await fireEvent(screen.getByTestId('home-body'), 'layout', layout(216));
    await flush();
    expect(shown('first-run-dots')).toBe(false);
  });
});

describe('HomeScreen Reminder offer', () => {
  test('appears below 「1日目」 once the saved feedback is over', async () => {
    await open();
    await save();
    await wait(SAVED_FEEDBACK_MS - 1);
    expect(shown('reminder-offer')).toBe(false);
    await wait(1);
    expect(screen.getByTestId('reminder-offer')).toBeTruthy();
    expect(screen.getByText('記録のない日の21時に、')).toBeTruthy();
    expect(screen.getByText('お知らせしましょうか？')).toBeTruthy();
    expect(shown('first-day')).toBe(true);
  });

  test('adds no announcement and moves no focus when it appears', async () => {
    mockScreenReader = true;
    await open();
    await save();
    await wait(SAVED_FEEDBACK_MS + 1000);
    expect(shown('reminder-offer')).toBe(true);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(focus).not.toHaveBeenCalled();
  });

  test('waits for the keyboard to close', async () => {
    const view = await open();
    await save();
    mockKeyboard = true;
    await view.rerender(app());
    await wait(SAVED_FEEDBACK_MS);
    expect(shown('reminder-offer')).toBe(false);
    mockKeyboard = false;
    await view.rerender(app());
    expect(shown('reminder-offer')).toBe(true);
  });

  test('stays for the rest of the day, also after a relaunch', async () => {
    const view = await open();
    await save();
    await wait(SAVED_FEEDBACK_MS);
    await relaunch(view);
    expect(shown('reminder-offer')).toBe(true);
  });

  test('いらない closes it for good and takes TalkBack to the Streak', async () => {
    mockScreenReader = true;
    const view = await open();
    await save();
    await wait(SAVED_FEEDBACK_MS);
    await fireEvent.press(screen.getByTestId('reminder-offer-decline'));
    await wait(100);
    expect(shown('reminder-offer')).toBe(false);
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
    expect(settings.settings.reminderEnabled).toBe(false);
    await relaunch(view);
    expect(shown('reminder-offer')).toBe(false);
    expect(shown('first-day')).toBe(true);
  });

  test('設定する keeps the card, disabled, until Android answers, then says when', async () => {
    await seedSettings({ reminderHour: 7, reminderMinute: 30 });
    let grant!: (v: boolean) => void;
    mockRequest = () => new Promise((resolve) => (grant = resolve));
    await open();
    await save();
    await wait(SAVED_FEEDBACK_MS);
    expect(screen.getByText('記録のない日の7時30分に、')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('reminder-offer-accept'));
    await flush();
    expect(screen.getByTestId('reminder-offer-accept')).toBeDisabled();
    expect(screen.getByTestId('reminder-offer-decline')).toBeDisabled();

    await act(async () => grant(true));
    await flush();
    expect(shown('reminder-offer')).toBe(false);
    expect(screen.getByTestId('reminder-set')).toHaveAccessibleName(
      '記録のない日の7時30分に、お知らせします。時刻は、設定で変えられます。'
    );
    expect(settings.settings.reminderEnabled).toBe(true);
    expect((await loadSettings()).reminderEnabled).toBe(true);
  });

  test('is answered before the system dialog, so an interrupted dialog never brings it back', async () => {
    mockRequest = () => new Promise(() => {});
    const view = await open();
    await save();
    await wait(SAVED_FEEDBACK_MS);
    await fireEvent.press(screen.getByTestId('reminder-offer-accept'));
    await flush();
    await relaunch(view);
    expect(shown('reminder-offer')).toBe(false);
  });

  test("a refusal in Android's dialog closes it silently, and it never comes back", async () => {
    let answer!: (v: boolean) => void;
    mockRequest = () => new Promise((resolve) => (answer = resolve));
    const view = await open();
    await save();
    await wait(SAVED_FEEDBACK_MS);
    await fireEvent.press(screen.getByTestId('reminder-offer-accept'));
    await flush();
    // Android's screen is up while the user reads it and answers.
    await emitAppState('background');
    await wait(2000);
    await emitAppState('active');
    await act(async () => answer(false));
    await flush();
    expect(shown('reminder-offer')).toBe(false);
    expect(alert).not.toHaveBeenCalled();
    expect(settings.settings.reminderEnabled).toBe(false);
    await relaunch(view);
    expect(shown('reminder-offer')).toBe(false);
  });

  test('when Android shows no dialog, the Settings switch\'s Alert explains', async () => {
    mockRequest = async () => false;
    await open();
    await save();
    await wait(SAVED_FEEDBACK_MS);
    await fireEvent.press(screen.getByTestId('reminder-offer-accept'));
    await flush();
    expect(alert).toHaveBeenCalledWith(
      '通知が許可されていません',
      '設定アプリから通知を許可してください',
      expect.anything()
    );
    expect(shown('reminder-offer')).toBe(false);
  });

  // Android 13+ opens its permission screen even when it has nothing to ask,
  // and closes it at once: the app goes away and back in a moment.
  test('a permission screen that closes by itself is not an answer: the Alert explains', async () => {
    let answer!: (v: boolean) => void;
    mockRequest = () => new Promise((resolve) => (answer = resolve));
    await open();
    await save();
    await wait(SAVED_FEEDBACK_MS);
    await fireEvent.press(screen.getByTestId('reminder-offer-accept'));
    await flush();
    await emitAppState('background');
    await wait(30);
    await emitAppState('active');
    await act(async () => answer(false));
    await flush();
    expect(alert).toHaveBeenCalledWith(
      '通知が許可されていません',
      '設定アプリから通知を許可してください',
      expect.anything()
    );
  });

  describe('TalkBack after 設定する', () => {
    const focusedOn = () =>
      focus.mock.calls.map(([node]) => (node as { props: { accessibilityLabel?: string } }).props.accessibilityLabel);
    beforeEach(() => {
      mockScreenReader = true;
    });

    test('with no dialog, it goes to the confirmation once it has faded in', async () => {
      await open();
      await save();
      await wait(SAVED_FEEDBACK_MS);
      await fireEvent.press(screen.getByTestId('reminder-offer-accept'));
      await flush();
      await wait(FADE_MS - 1);
      expect(focus).not.toHaveBeenCalled();
      await wait(1);
      expect(focusedOn()).toEqual([
        '記録のない日の21時に、お知らせします。時刻は、設定で変えられます。',
      ]);
    });

    test('after a refusal in Android\'s dialog, it goes to the Streak once the app is back', async () => {
      let answer!: (v: boolean) => void;
      mockRequest = () => new Promise((resolve) => (answer = resolve));
      await open();
      await save();
      await wait(SAVED_FEEDBACK_MS);
      await fireEvent.press(screen.getByTestId('reminder-offer-accept'));
      await flush();
      await emitAppState('background');
      await wait(2000);
      await emitAppState('active');
      await act(async () => answer(false));
      await flush();
      await wait(STREAK_IN_PLACE_MS - 1);
      expect(focus).not.toHaveBeenCalled();
      await wait(1);
      expect(focusedOn()).toHaveLength(1);
      expect(focusedOn()[0]).toMatch(/^1日連続。/);
    });

    test('when Android shows no dialog, OK on the Alert takes it to the Streak', async () => {
      mockRequest = async () => false;
      await open();
      await save();
      await wait(SAVED_FEEDBACK_MS);
      await fireEvent.press(screen.getByTestId('reminder-offer-accept'));
      await flush();
      expect(focus).not.toHaveBeenCalled();
      const buttons = alert.mock.calls[0]?.[2] as Array<{ onPress?: () => void }>;
      await act(async () => buttons[0]?.onPress?.());
      expect(focusedOn()).toHaveLength(1);
      expect(focusedOn()[0]).toMatch(/^1日連続。/);
    });
  });

  test('is never shown when Reminders are already on, or blocked for good', async () => {
    for (const setup of [
      () => seedSettings({ reminderEnabled: true }),
      async () => {
        mockPermission = 'blocked';
      },
    ]) {
      mockDb = openTestDatabase();
      await AsyncStorage.clear();
      mockPermission = 'askable';
      await setup();
      const view = await open();
      await save();
      await wait(SAVED_FEEDBACK_MS);
      expect(shown('reminder-offer')).toBe(false);
      expect(await loadFirstRun()).toEqual({ kind: 'started', day: today(), offer: 'closed' });
      await view.unmount();
    }
  });

  // Someone who has been writing from History is not a first-time user, even
  // though no save on Home started their first day (ADR 0002).
  test('someone who wrote on an earlier day is not greeted as new', async () => {
    await seedFirstRun({ kind: 'new' });
    await writeBeforeLaunch([-1, -2, -3], 1);
    await open();
    expect(await loadFirstRun()).toEqual({ kind: 'returning' });
    await save();
    await wait(SAVED_FEEDBACK_MS);
    for (const id of ['first-run-dots', 'first-run-privacy', 'first-day', 'reminder-offer']) {
      expect(shown(id)).toBe(false);
    }
  });

  test('writing only from History on the first day ends it at midnight', async () => {
    jest.setSystemTime(new Date(2026, 8, 25, 23, 50, 0));
    await open();
    await act(async () => entries.upsert('2026-09-25', 'from History'));
    await flush();
    expect(await loadFirstRun()).toEqual({ kind: 'new' });
    await wait(11 * 60 * 1000);
    await flush();
    expect(await loadFirstRun()).toEqual({ kind: 'returning' });
  });

  test("a save on a 「また今日から」 day does not open it", async () => {
    await seedFirstRun({ kind: 'new' });
    await writeBeforeLaunch([-3]);
    await open();
    await save();
    await wait(SAVED_FEEDBACK_MS);
    expect(shown('reminder-offer')).toBe(false);
    expect(await loadFirstRun()).toEqual({ kind: 'new' });
  });

  test('a save on a day with a Streak repair offer does not open it', async () => {
    await seedFirstRun({ kind: 'new' });
    await writeBeforeLaunch([-2]);
    await open();
    expect(shown('streak-repair')).toBe(true);
    await save();
    await wait(SAVED_FEEDBACK_MS);
    expect(shown('reminder-offer')).toBe(false);
    expect(await loadFirstRun()).toEqual({ kind: 'new' });
  });

  // Material: one banner at a time. A repair offer that came while Home was
  // behind History counts for the visit that shows it.
  test('never in the same visit as a Streak repair offer', async () => {
    const view = await open();
    await save();
    await wait(SAVED_FEEDBACK_MS);
    expect(shown('reminder-offer')).toBe(true);

    mockFocused = false;
    await view.rerender(app());
    await act(async () => entries.upsert(addDays(today(), -2), 'two days ago'));
    await flush();
    mockFocused = true;
    await view.rerender(app());
    expect(shown('streak-repair')).toBe(true);
    expect(shown('reminder-offer')).toBe(false);

    await fireEvent.press(screen.getByTestId('streak-repair-close'));
    await flush();
    expect(shown('streak-repair')).toBe(false);
    expect(shown('reminder-offer')).toBe(false);

    // The next visit.
    mockFocused = false;
    await view.rerender(app());
    mockFocused = true;
    await view.rerender(app());
    expect(shown('reminder-offer')).toBe(true);
  });

  // ADR 0002: the first day's content ends at its midnight.
  test('the confirmation goes when the first day ends', async () => {
    jest.setSystemTime(new Date(2026, 8, 25, 23, 50, 0));
    await open();
    await save();
    await wait(SAVED_FEEDBACK_MS);
    await fireEvent.press(screen.getByTestId('reminder-offer-accept'));
    await flush();
    expect(shown('reminder-set')).toBe(true);
    await wait(11 * 60 * 1000);
    expect(screen.getByText(/9月26日/)).toBeTruthy();
    expect(shown('reminder-set')).toBe(false);
  });

  // The answer to 設定する is confirmed on the day it comes, even when
  // Android's screen was answered after midnight.
  test('a permission screen answered after midnight is still confirmed', async () => {
    jest.setSystemTime(new Date(2026, 8, 25, 23, 58, 0));
    let answer!: (v: boolean) => void;
    mockRequest = () => new Promise((resolve) => (answer = resolve));
    await open();
    await save();
    await wait(SAVED_FEEDBACK_MS);
    await fireEvent.press(screen.getByTestId('reminder-offer-accept'));
    await flush();
    await emitAppState('background');
    await wait(3 * 60 * 1000);
    await emitAppState('active');
    await act(async () => answer(true));
    await flush();
    expect(screen.getByText(/9月26日/)).toBeTruthy();
    expect(shown('reminder-set')).toBe(true);
  });

  // useToday moves the date a second after midnight; an answer in between is
  // still confirmed, and stays on the day it came.
  test('an answer in the second after midnight is confirmed at once', async () => {
    jest.setSystemTime(new Date(2026, 8, 25, 23, 58, 0));
    mockRequest = async () => true;
    await open();
    await save();
    await wait(SAVED_FEEDBACK_MS);
    jest.setSystemTime(new Date(2026, 8, 26, 0, 0, 0, 300));
    await fireEvent.press(screen.getByTestId('reminder-offer-accept'));
    await flush();
    expect(screen.getByText(/9月25日/)).toBeTruthy();
    expect(shown('reminder-set')).toBe(true);
    // The midnight timer set at 23:58 fires.
    await wait(3 * 60 * 1000);
    expect(screen.getByText(/9月26日/)).toBeTruthy();
    expect(shown('reminder-set')).toBe(true);
  });

  test('the confirmation goes when Home is left', async () => {
    const view = await open();
    await save();
    await wait(SAVED_FEEDBACK_MS);
    await fireEvent.press(screen.getByTestId('reminder-offer-accept'));
    await flush();
    expect(shown('reminder-set')).toBe(true);
    mockFocused = false;
    await view.rerender(app());
    mockFocused = true;
    await view.rerender(app());
    expect(shown('reminder-set')).toBe(false);
    expect(shown('reminder-offer')).toBe(false);
  });

  test('waits while a full-screen celebration is due, and appears after it closes', async () => {
    await seedFirstRun({ kind: 'new' });
    await writeBeforeLaunch([-1, -2]);
    await open();
    await save('third day');
    await wait(revealDelayMs({ reduceMotion: true, screenReader: false }));
    expect(screen.getByTestId('celebration')).toBeTruthy();
    await wait(SAVED_FEEDBACK_MS + ENTRANCE_MS);
    expect(shown('reminder-offer')).toBe(false);

    await fireEvent.press(screen.getByTestId('celebration-close'));
    await wait(AFTER_CLOSE_PAUSE_MS);
    expect(shown('reminder-offer')).toBe(true);
  });

  // Written from History while the card is out: it steps aside for the full
  // screen, and comes back when that closes.
  test('steps aside for a celebration that comes later that day', async () => {
    await open();
    await save();
    await wait(SAVED_FEEDBACK_MS);
    expect(shown('reminder-offer')).toBe(true);

    await act(async () => {
      await entries.upsert(addDays(today(), -1), 'yesterday');
      await entries.upsert(addDays(today(), -2), 'the day before');
    });
    await flush();
    await wait(revealDelayMs({ reduceMotion: true, screenReader: false }));
    expect(screen.getByTestId('celebration')).toBeTruthy();
    expect(shown('reminder-offer')).toBe(false);

    await wait(ENTRANCE_MS);
    await fireEvent.press(screen.getByTestId('celebration-close'));
    await wait(AFTER_CLOSE_PAUSE_MS);
    expect(shown('reminder-offer')).toBe(true);
  });

  test('the backup reminder stays silent while the offer is open', async () => {
    await open();
    await save();
    await wait(SAVED_FEEDBACK_MS);
    expect(shown('reminder-offer')).toBe(true);
    expect(mockRemind).not.toHaveBeenCalled();
  });
});
