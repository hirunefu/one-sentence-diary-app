import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';

// Run the real provider against the in-memory better-sqlite3 database.
jest.mock('../db/database', () => ({
  openDatabase: () => require('../db/testDatabase').openTestDatabase(),
}));

import { EntriesProvider, useEntries } from './EntriesContext';
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
