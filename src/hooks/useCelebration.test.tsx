import React from 'react';
import { AppState, Keyboard } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The real Entries provider on one in-memory database shared across mounts,
// so an unmount and a mount model a lock or a restart.
let mockSharedDb: Promise<DiaryDatabase> | null = null;
jest.mock('../db/database', () => ({ openDatabase: () => mockSharedDb }));
let mockReduceMotion = false;
jest.mock('./useReduceMotion', () => ({ useReduceMotion: () => mockReduceMotion }));
let mockScreenReader = false;
jest.mock('./useScreenReaderEnabled', () => ({ useScreenReaderEnabled: () => mockScreenReader }));
let mockAppActive = true;
jest.mock('./useAppActive', () => ({ useAppActive: () => mockAppActive }));

import { AFTER_CLOSE_PAUSE_MS, revealDelayMs, useCelebration } from './useCelebration';
import { STREAK_IN_PLACE_MS } from '../components/StreakDisplay';
import { EntriesProvider, useEntries } from '../contexts/EntriesContext';
import type { DiaryDatabase } from '../db/database';
import { openTestDatabase } from '../db/testDatabase';
import { upsertEntry } from '../repositories/entriesRepository';
import { addDays, today } from '../utils/date';

const REVEAL = revealDelayMs({ reduceMotion: false, screenReader: false });

async function writeBeforeLaunch(offsets: number[]) {
  const db = await mockSharedDb!;
  for (const offset of offsets) {
    await upsertEntry(db, { date: addDays(today(), offset), text: 'before', now: 1 });
  }
}

async function launch(enabled = true) {
  const hook = await renderHook(
    ({ enabled, todayStr }: { enabled: boolean; todayStr?: string }) => ({
      entries: useEntries(),
      celebration: useCelebration({ enabled, todayStr: todayStr ?? today() }),
    }),
    {
      wrapper: EntriesProvider,
      initialProps: { enabled } as { enabled: boolean; todayStr?: string },
    }
  );
  await waitFor(() => expect(hook.result.current.entries.ready).toBe(true));
  return hook;
}

type Hook = Awaited<ReturnType<typeof launch>>;

const write = (hook: Hook, offset: number) =>
  act(async () => {
    await hook.result.current.entries.upsert(addDays(today(), offset), 'written');
  });
const wait = (ms: number) => act(async () => jest.advanceTimersByTime(ms));
const shown = (hook: Hook) => {
  const c = hook.result.current.celebration.showing;
  return c && `${c.milestone ?? '-'}/${c.previousLongest ?? '-'}@${c.streak}`;
};

describe('useCelebration', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    await AsyncStorage.clear();
    mockSharedDb = openTestDatabase();
    mockReduceMotion = false;
    mockScreenReader = false;
    mockAppActive = true;
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    mockSharedDb = null;
  });

  test('the Streak found at the first launch is never celebrated', async () => {
    await writeBeforeLaunch(Array.from({ length: 40 }, (_, i) => -i));
    const hook = await launch();
    await wait(5000);
    expect(shown(hook)).toBeNull();
    expect(hook.result.current.celebration.due).toBe(false);
  });

  test('a save that reaches 3 is due at once, and shown after the in-place change', async () => {
    await writeBeforeLaunch([-1, -2]);
    const hook = await launch();
    await write(hook, 0);
    expect(hook.result.current.celebration.due).toBe(true);
    await wait(REVEAL - 1);
    expect(shown(hook)).toBeNull();
    await wait(1);
    expect(shown(hook)).toBe('3/-@3');
  });

  test('Backfills made away from Home show the highest Milestone once Home is back', async () => {
    await writeBeforeLaunch([0]);
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    const hook = await launch(false);
    for (let i = 1; i <= 15; i++) await write(hook, -i);
    await wait(5000);
    expect(shown(hook)).toBeNull();
    // Nothing reaches for the screen meanwhile (the editor keeps its keyboard).
    expect(dismiss).not.toHaveBeenCalled();

    await hook.rerender({ enabled: true });
    await wait(REVEAL);
    expect(shown(hook)).toBe('14/-@16');
  });

  test('leaving Home during the pause cancels it; coming back waits the whole pause', async () => {
    await writeBeforeLaunch([-1, -2]);
    const hook = await launch();
    await write(hook, 0);
    await wait(REVEAL - 100);
    await hook.rerender({ enabled: false });
    await wait(5000);
    expect(shown(hook)).toBeNull();

    await hook.rerender({ enabled: true });
    await wait(REVEAL - 1);
    expect(shown(hook)).toBeNull();
    await wait(1);
    expect(shown(hook)).toBe('3/-@3');
  });

  test('nothing is shown while the app is in the background', async () => {
    await writeBeforeLaunch([-1, -2]);
    mockAppActive = false;
    const hook = await launch();
    await write(hook, 0);
    await wait(5000);
    expect(shown(hook)).toBeNull();

    mockAppActive = true;
    await hook.rerender({ enabled: true });
    await wait(REVEAL);
    expect(shown(hook)).toBe('3/-@3');
  });

  test('once it has been seen, a restart does not show it again', async () => {
    await writeBeforeLaunch([-1, -2]);
    const first = await launch();
    await write(first, 0);
    await wait(REVEAL);
    await act(async () => first.result.current.celebration.settled());
    await first.unmount();

    const again = await launch();
    await wait(5000);
    expect(shown(again)).toBeNull();
  });

  test('an entrance that ends in the background does not count as seen', async () => {
    await writeBeforeLaunch([-1, -2]);
    const first = await launch();
    await write(first, 0);
    await wait(REVEAL);
    const state = AppState as { currentState: unknown };
    const original = state.currentState;
    state.currentState = 'background';
    try {
      await act(async () => first.result.current.celebration.settled());
    } finally {
      state.currentState = original;
    }
    await first.unmount();

    const again = await launch();
    await wait(REVEAL);
    expect(shown(again)).toBe('3/-@3');
  });

  test('if the app locks before it was seen, it is shown again after unlocking', async () => {
    await writeBeforeLaunch([-1, -2]);
    const first = await launch();
    await write(first, 0);
    await wait(REVEAL);
    expect(shown(first)).toBe('3/-@3');
    await first.unmount();

    const again = await launch();
    await wait(REVEAL);
    expect(shown(again)).toBe('3/-@3');
  });

  test('closing it counts as seen, even before it came to rest', async () => {
    await writeBeforeLaunch([-1, -2]);
    const first = await launch();
    await write(first, 0);
    await wait(REVEAL);
    await act(async () => first.result.current.celebration.close());
    expect(shown(first)).toBeNull();
    await wait(5000);
    expect(shown(first)).toBeNull();
    await first.unmount();

    const again = await launch();
    await wait(5000);
    expect(shown(again)).toBeNull();
  });

  test('the backup reminder waits until the celebration is closed', async () => {
    await writeBeforeLaunch([-1, -2]);
    const hook = await launch();
    const remind = jest.fn();
    await write(hook, 0);
    await act(async () => hook.result.current.celebration.afterCelebration(remind));
    await wait(REVEAL + 5000);
    expect(remind).not.toHaveBeenCalled();

    await act(async () => hook.result.current.celebration.close());
    await wait(AFTER_CLOSE_PAUSE_MS - 1);
    expect(remind).not.toHaveBeenCalled();
    await wait(1);
    expect(remind).toHaveBeenCalledTimes(1);
  });

  test('two saves behind one celebration remind once', async () => {
    await writeBeforeLaunch([-1, -2]);
    const hook = await launch();
    const first = jest.fn();
    const second = jest.fn();
    await write(hook, 0);
    await act(async () => hook.result.current.celebration.afterCelebration(first));
    await act(async () => hook.result.current.celebration.afterCelebration(second));
    await wait(REVEAL);
    await act(async () => hook.result.current.celebration.close());
    await wait(AFTER_CLOSE_PAUSE_MS);
    expect(first.mock.calls.length + second.mock.calls.length).toBe(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  test('without a celebration, the backup reminder runs at once', async () => {
    await writeBeforeLaunch([-1]);
    const hook = await launch();
    const remind = jest.fn();
    await write(hook, 0);
    await act(async () => hook.result.current.celebration.afterCelebration(remind));
    expect(remind).toHaveBeenCalledTimes(1);
  });
});

describe('useCelebration, a new Longest streak alone', () => {
  // An earlier stretch of 10, a gap, and a current Streak of 10 ending yesterday:
  // saving today makes 11, past the Longest streak but not a Milestone.
  const EARLIER_AND_CURRENT = [
    ...Array.from({ length: 10 }, (_, i) => -13 - i),
    ...Array.from({ length: 10 }, (_, i) => -1 - i),
  ];
  const longest = (hook: Hook) => {
    const l = hook.result.current.celebration.longestToday;
    return l && `${l.previousLongest}@${l.streak}`;
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    await AsyncStorage.clear();
    mockSharedDb = openTestDatabase();
    mockReduceMotion = false;
    mockScreenReader = false;
    mockAppActive = true;
  });
  afterEach(() => {
    jest.useRealTimers();
    mockSharedDb = null;
  });

  test('is told in place once the number settles, never on the full screen', async () => {
    await writeBeforeLaunch(EARLIER_AND_CURRENT);
    const hook = await launch();
    await write(hook, 0);
    expect(hook.result.current.celebration.longestDue?.previousLongest).toBe(10);
    expect(hook.result.current.celebration.due).toBe(false);
    await wait(STREAK_IN_PLACE_MS - 1);
    expect(longest(hook)).toBeNull();
    await wait(1);
    expect(longest(hook)).toBe('10@11');
    await wait(5000);
    expect(shown(hook)).toBeNull();
  });

  test('does not hold the backup reminder back', async () => {
    await writeBeforeLaunch(EARLIER_AND_CURRENT);
    const hook = await launch();
    const remind = jest.fn();
    await write(hook, 0);
    await act(async () => hook.result.current.celebration.afterCelebration(remind));
    expect(remind).toHaveBeenCalledTimes(1);
  });

  test('is told once: not again after a restart, and gone the next day', async () => {
    await writeBeforeLaunch(EARLIER_AND_CURRENT);
    const first = await launch();
    await write(first, 0);
    await wait(STREAK_IN_PLACE_MS);
    expect(longest(first)).toBe('10@11');

    await first.rerender({ enabled: true, todayStr: addDays(today(), 1) });
    expect(longest(first)).toBeNull();
    await first.unmount();

    const again = await launch();
    await wait(5000);
    expect(longest(again)).toBeNull();
    expect(again.result.current.celebration.longestDue).toBeNull();
  });

  test("goes when today's Entry is deleted and the Streak drops", async () => {
    await writeBeforeLaunch(EARLIER_AND_CURRENT);
    const hook = await launch();
    await write(hook, 0);
    await wait(STREAK_IN_PLACE_MS);
    expect(longest(hook)).toBe('10@11');
    await act(async () => hook.result.current.entries.remove(today()));
    expect(longest(hook)).toBeNull();
  });

  test('waits for Home when today is written from History', async () => {
    await writeBeforeLaunch(EARLIER_AND_CURRENT);
    const hook = await launch(false);
    await write(hook, 0);
    await wait(5000);
    expect(longest(hook)).toBeNull();

    await hook.rerender({ enabled: true });
    await wait(STREAK_IN_PLACE_MS);
    expect(longest(hook)).toBe('10@11');
  });
});
