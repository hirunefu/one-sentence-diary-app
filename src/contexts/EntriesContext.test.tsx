import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';

// Run the real provider against the in-memory better-sqlite3 database. A test
// can share one database across mounts to model a relaunch.
let mockSharedDb: Promise<DiaryDatabase> | null = null;
jest.mock('../db/database', () => ({
  openDatabase: () => mockSharedDb ?? require('../db/testDatabase').openTestDatabase(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { EntriesProvider, useEntries } from './EntriesContext';
import type { DiaryDatabase } from '../db/database';
import { openTestDatabase } from '../db/testDatabase';
import { upsertEntry } from '../repositories/entriesRepository';
import {
  loadCelebrationLedger,
  saveCelebrationLedger,
} from '../repositories/celebrationRepository';
import { decideCelebration, EMPTY_LEDGER, type CelebrationLedger } from '../services/celebration';
import { classifyEntries } from '../services/importService';
import { addDays, today } from '../utils/date';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <EntriesProvider>{children}</EntriesProvider>
);

describe('EntriesProvider.upsert', () => {
  test('refuses a future day and keeps no Entry for it', async () => {
    const { result } = await renderHook(() => useEntries(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    const tomorrow = addDays(today(), 1);
    await act(async () => {
      await expect(result.current.upsert(tomorrow, 'too early')).rejects.toThrow();
    });
    expect(await result.current.getByDate(tomorrow)).toBeNull();
  });

  test('accepts today and a past day', async () => {
    const { result } = await renderHook(() => useEntries(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await result.current.upsert(today(), 'today');
      await result.current.upsert(addDays(today(), -3), 'backfilled');
    });
    expect((await result.current.getByDate(today()))?.text).toBe('today');
    expect((await result.current.getByDate(addDays(today(), -3)))?.text).toBe('backfilled');
  });
});

describe('EntriesProvider celebration ledger', () => {
  const dates = (result: { current: ReturnType<typeof useEntries> }) =>
    result.current.entries.map((e) => e.date);
  const decide = (result: { current: ReturnType<typeof useEntries> }) =>
    decideCelebration(dates(result), today(), result.current.celebrationLedger).celebration;

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockSharedDb = openTestDatabase();
  });
  afterEach(() => {
    mockSharedDb = null;
  });

  async function writeBeforeLaunch(offsets: number[]) {
    const db = await mockSharedDb!;
    for (const offset of offsets) {
      await upsertEntry(db, { date: addDays(today(), offset), text: 'before', now: 1 });
    }
  }

  test('the first launch counts the Streak already there as told', async () => {
    await writeBeforeLaunch([0, -1, -2, -3, -4, -5, -6]);
    const { result } = await renderHook(() => useEntries(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.streak).toBe(7);
    expect(decide(result)).toBeNull();
    expect(await loadCelebrationLedger()).toEqual(result.current.celebrationLedger);
  });

  test('a saved ledger is used as it is', async () => {
    await writeBeforeLaunch([0, -1]);
    const saved: CelebrationLedger = { ...EMPTY_LEDGER };
    await saveCelebrationLedger(saved);
    const { result } = await renderHook(() => useEntries(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.celebrationLedger).toEqual(saved);
  });

  test('an unreadable ledger is seeded again', async () => {
    await writeBeforeLaunch([0, -1, -2]);
    await AsyncStorage.setItem('celebration.ledger', '{');
    const { result } = await renderHook(() => useEntries(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(decide(result)).toBeNull();
    expect(await loadCelebrationLedger()).not.toBeNull();
  });

  test('a restored backup counts as already celebrated', async () => {
    const { result } = await renderHook(() => useEntries(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    const week = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
      date: addDays(today(), -d),
      text: 'restored',
      createdAt: 1,
      updatedAt: 1,
    }));
    await act(async () => {
      await result.current.bulkImport(classifyEntries(week, new Set(), today()), 'skip');
    });

    expect(result.current.streak).toBe(7);
    expect(decide(result)).toBeNull();
    expect(await loadCelebrationLedger()).toEqual(result.current.celebrationLedger);
  });

  test('an import that leaves the Streak as it was keeps a Milestone not yet shown', async () => {
    await writeBeforeLaunch([0, -1]);
    const { result } = await renderHook(() => useEntries(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    // Reached by writing, while Home is not in front: due, not yet shown.
    await act(async () => {
      await result.current.upsert(addDays(today(), -2), 'backfilled');
    });

    const old = [{ date: addDays(today(), -40), text: 'old', createdAt: 1, updatedAt: 1 }];
    await act(async () => {
      await result.current.bulkImport(classifyEntries(old, new Set(), today()), 'skip');
    });

    expect(decide(result)?.milestone).toBe(3);
  });

  test('the Streak follows the day past midnight', async () => {
    jest.useFakeTimers({ now: new Date(2026, 4, 15, 23, 59, 58) });
    try {
      await writeBeforeLaunch([-1, -2]);
      const { result } = await renderHook(() => useEntries(), { wrapper });
      await waitFor(() => expect(result.current.ready).toBe(true));
      expect(result.current.streak).toBe(2);

      await act(async () => jest.advanceTimersByTime(5000));
      expect(result.current.streak).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  test('a ledger that cannot be saved is still kept for this session', async () => {
    const { result } = await renderHook(() => useEntries(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));

    const next: CelebrationLedger = {
      stretches: [],
      seen: { start: today(), end: today(), length: 1 },
      longest: null,
    };
    await act(async () => {
      result.current.commitCelebrationLedger(next);
    });

    expect(result.current.celebrationLedger).toEqual(next);
    await waitFor(() => expect(error).toHaveBeenCalled());
    error.mockRestore();
  });
});

describe('EntriesProvider Streak break and repair', () => {
  const yesterday = () => addDays(today(), -1);

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockSharedDb = openTestDatabase();
  });
  afterEach(() => {
    mockSharedDb = null;
  });

  async function writeBeforeLaunch(offsets: number[]) {
    const db = await mockSharedDb!;
    for (const offset of offsets) {
      await upsertEntry(db, { date: addDays(today(), offset), text: 'before', now: 1 });
    }
  }

  test('offers to write yesterday when it is the only missing day', async () => {
    await writeBeforeLaunch([-2, -3]);
    const { result } = await renderHook(() => useEntries(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.todayStr).toBe(today());
    expect(result.current.streakBreak).toEqual({
      headline: 'blank',
      offer: { missingDay: yesterday(), streakAfter: 3 },
    });
  });

  test('knows a declined day before it is ready, so the offer never flashes', async () => {
    await writeBeforeLaunch([-2, -3]);
    await AsyncStorage.setItem('streakRepair.declinedDay', yesterday());
    const offers: unknown[] = [];
    const { result } = await renderHook(
      () => {
        const value = useEntries();
        if (value.ready) offers.push(value.streakBreak.offer);
        return value;
      },
      { wrapper }
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((o) => o === null)).toBe(true);
    expect(result.current.streakBreak.headline).toBe('restart');
  });

  test('declining keeps the day, also after a relaunch', async () => {
    await writeBeforeLaunch([-2, -3]);
    const first = await renderHook(() => useEntries(), { wrapper });
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    await act(async () => first.result.current.declineRepair(yesterday()));
    expect(first.result.current.streakBreak).toEqual({ headline: 'restart', offer: null });
    await first.unmount();

    const again = await renderHook(() => useEntries(), { wrapper });
    await waitFor(() => expect(again.result.current.ready).toBe(true));
    expect(again.result.current.streakBreak.offer).toBeNull();
  });

  test("deleting yesterday's Entry declines its repair", async () => {
    await writeBeforeLaunch([-1, -2, -3]);
    const { result } = await renderHook(() => useEntries(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => result.current.remove(yesterday()));
    expect(result.current.streakBreak).toEqual({ headline: 'restart', offer: null });
  });

  test("deleting another day's Entry leaves the offer standing", async () => {
    await writeBeforeLaunch([-2, -3, -4]);
    const { result } = await renderHook(() => useEntries(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => result.current.remove(addDays(today(), -4)));
    expect(result.current.streakBreak.offer).toEqual({ missingDay: yesterday(), streakAfter: 3 });
  });

  test('an unreadable declined day still offers the repair', async () => {
    await writeBeforeLaunch([-2, -3]);
    await AsyncStorage.setItem('streakRepair.declinedDay', 'garbage');
    const { result } = await renderHook(() => useEntries(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.streakBreak.offer?.streakAfter).toBe(3);
  });

  test('a decline that cannot be saved still holds for this session', async () => {
    await writeBeforeLaunch([-2, -3]);
    const { result } = await renderHook(() => useEntries(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    await act(async () => result.current.declineRepair(yesterday()));
    expect(result.current.streakBreak.offer).toBeNull();
    await waitFor(() => expect(error).toHaveBeenCalled());
    error.mockRestore();
  });

  test('seeding during a one-day lapse remembers the stretch before the gap', async () => {
    await writeBeforeLaunch([-2, -3, -4, -5, -6, -7, -8, -9, -10, -11]);
    const { result } = await renderHook(() => useEntries(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    const repaired = [yesterday(), ...result.current.entries.map((e) => e.date)].sort().reverse();
    const { celebration } = decideCelebration(repaired, today(), result.current.celebrationLedger);
    expect(celebration).toBeNull();
  });
});
