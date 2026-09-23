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
