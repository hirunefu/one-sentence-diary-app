import * as Notifications from 'expo-notifications';

export const REMINDER_NOTIFICATION_ID = 'daily-reminder';

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_NOTIFICATION_ID);
}

export async function rescheduleDailyReminder(
  hour: number,
  minute: number
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_NOTIFICATION_ID);
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_NOTIFICATION_ID,
    content: {
      title: '一口日記',
      body: '今日の一文を書きましょう',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}
