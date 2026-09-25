import React from 'react';
import { act, render } from '@testing-library/react-native';

let mockDb: Promise<DiaryDatabase>;
jest.mock('../db/database', () => ({ openDatabase: () => mockDb }));
jest.mock('../contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: { reminderEnabled: true, reminderHour: 21, reminderMinute: 0 },
    ready: true,
  }),
}));
const mockReschedule = jest.fn(async (_args: unknown) => {});
jest.mock('../services/notifications', () => ({
  rescheduleReminders: (args: unknown) => mockReschedule(args),
  cancelAllReminders: jest.fn(async () => {}),
}));

import { EntriesProvider } from '../contexts/EntriesContext';
import type { DiaryDatabase } from '../db/database';
import { openTestDatabase } from '../db/testDatabase';
import { ReminderScheduler } from './ReminderScheduler';

describe('ReminderScheduler', () => {
  beforeEach(() => {
    mockDb = openTestDatabase();
    mockReschedule.mockClear();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  // A Reminder left in the shade says 今日; after midnight it is about another
  // day, and a pass is what dismisses it.
  test('schedules again when the date turns over with the app open', async () => {
    jest.setSystemTime(new Date(2026, 8, 25, 23, 59, 0));
    await render(
      <EntriesProvider>
        <ReminderScheduler />
      </EntriesProvider>
    );
    await act(async () => jest.advanceTimersByTime(100));
    const before = mockReschedule.mock.calls.length;
    expect(before).toBeGreaterThan(0);

    await act(async () => jest.advanceTimersByTime(2 * 60 * 1000));
    expect(mockReschedule.mock.calls.length).toBeGreaterThan(before);
  });
});
