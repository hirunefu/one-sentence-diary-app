jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('scheduled-id'),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' },
}));

import * as Notifications from 'expo-notifications';
import {
  rescheduleReminders,
  cancelAllReminders,
  requestNotificationPermission,
  REMINDER_NOTIFICATION_ID_PREFIX,
  LEGACY_REMINDER_ID,
} from './notifications';

const mockCancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const mockSchedule = Notifications.scheduleNotificationAsync as jest.Mock;
const mockGetAll = Notifications.getAllScheduledNotificationsAsync as jest.Mock;
const mockRequestPerm = Notifications.requestPermissionsAsync as jest.Mock;

describe('notifications service', () => {
  beforeEach(() => {
    mockCancel.mockClear();
    mockSchedule.mockClear();
    mockGetAll.mockClear();
    mockGetAll.mockResolvedValue([]);
    mockRequestPerm.mockClear();
    jest.useFakeTimers();
    // 2026-04-28 09:00 ローカル
    jest.setSystemTime(new Date(2026, 3, 28, 9, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('rescheduleReminders schedules upcoming days, skipping recorded dates', async () => {
    const recordedDates = new Set(['2026-04-28', '2026-04-30']);
    await rescheduleReminders({
      hour: 21,
      minute: 0,
      recordedDates,
      daysAhead: 5,
    });
    // 04-28 (today, recorded) → skip
    // 04-29 → schedule
    // 04-30 (recorded) → skip
    // 05-01 → schedule
    // 05-02 → schedule
    expect(mockSchedule).toHaveBeenCalledTimes(3);
    const ids = mockSchedule.mock.calls.map((c) => c[0].identifier);
    expect(ids).toEqual([
      `${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-29`,
      `${REMINDER_NOTIFICATION_ID_PREFIX}2026-05-01`,
      `${REMINDER_NOTIFICATION_ID_PREFIX}2026-05-02`,
    ]);
  });

  test('rescheduleReminders skips today if reminder time has already passed', async () => {
    // Now = 09:00, reminder time = 08:00 → already passed today
    await rescheduleReminders({
      hour: 8,
      minute: 0,
      recordedDates: new Set(),
      daysAhead: 1,
    });
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  test('rescheduleReminders schedules today if reminder time is in the future', async () => {
    // Now = 09:00, reminder time = 21:00 → still in future today
    await rescheduleReminders({
      hour: 21,
      minute: 0,
      recordedDates: new Set(),
      daysAhead: 1,
    });
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule.mock.calls[0]?.[0].identifier).toBe(
      `${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-28`
    );
  });

  test('rescheduleReminders cancels existing reminders before scheduling', async () => {
    mockGetAll.mockResolvedValueOnce([
      { identifier: `${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-29` },
      { identifier: `${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-30` },
    ]);
    await rescheduleReminders({
      hour: 21,
      minute: 0,
      recordedDates: new Set(),
      daysAhead: 0,
    });
    // legacy + 2 per-day
    expect(mockCancel).toHaveBeenCalledWith(LEGACY_REMINDER_ID);
    expect(mockCancel).toHaveBeenCalledWith(`${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-29`);
    expect(mockCancel).toHaveBeenCalledWith(`${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-30`);
  });

  test('cancelAllReminders cancels legacy ID and per-day reminders, ignores others', async () => {
    mockGetAll.mockResolvedValueOnce([
      { identifier: `${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-29` },
      { identifier: 'other-notification' },
    ]);
    await cancelAllReminders();
    expect(mockCancel).toHaveBeenCalledWith(LEGACY_REMINDER_ID);
    expect(mockCancel).toHaveBeenCalledWith(`${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-29`);
    expect(mockCancel).not.toHaveBeenCalledWith('other-notification');
  });

  test('requestNotificationPermission returns true if granted', async () => {
    mockRequestPerm.mockResolvedValueOnce({ status: 'granted' });
    expect(await requestNotificationPermission()).toBe(true);
  });

  test('requestNotificationPermission returns false if denied', async () => {
    mockRequestPerm.mockResolvedValueOnce({ status: 'denied' });
    expect(await requestNotificationPermission()).toBe(false);
  });
});
