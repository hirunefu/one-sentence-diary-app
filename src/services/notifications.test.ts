import {
  rescheduleDailyReminder,
  cancelAllReminders,
  requestNotificationPermission,
  REMINDER_NOTIFICATION_ID,
} from './notifications';

jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('scheduled-id'),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));

import * as Notifications from 'expo-notifications';

describe('notifications service', () => {
  beforeEach(() => {
    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockClear();
    (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();
    (Notifications.cancelAllScheduledNotificationsAsync as jest.Mock).mockClear();
    (Notifications.requestPermissionsAsync as jest.Mock).mockClear();
  });

  test('rescheduleDailyReminder cancels existing then schedules new', async () => {
    await rescheduleDailyReminder(21, 0);

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      REMINDER_NOTIFICATION_ID
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: REMINDER_NOTIFICATION_ID,
        trigger: expect.objectContaining({ hour: 21, minute: 0 }),
      })
    );
  });

  test('cancelAllReminders cancels by ID', async () => {
    await cancelAllReminders();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      REMINDER_NOTIFICATION_ID
    );
  });

  test('requestNotificationPermission returns true if granted', async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });
    expect(await requestNotificationPermission()).toBe(true);
  });

  test('requestNotificationPermission returns false if denied', async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });
    expect(await requestNotificationPermission()).toBe(false);
  });
});
