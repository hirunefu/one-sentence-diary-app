import * as Notifications from 'expo-notifications';
import { addDays, today } from '../utils/date';

export const REMINDER_NOTIFICATION_ID_PREFIX = 'daily-reminder-';
// 旧バージョンが使っていた単一 DAILY 通知の ID。アップグレード時のクリーンアップ用。
export const LEGACY_REMINDER_ID = 'daily-reminder';
export const DEFAULT_DAYS_AHEAD = 14;

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(LEGACY_REMINDER_ID);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier?.startsWith(REMINDER_NOTIFICATION_ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

type RescheduleArgs = {
  hour: number;
  minute: number;
  recordedDates: ReadonlySet<string>;
  daysAhead?: number;
};

export async function rescheduleReminders({
  hour,
  minute,
  recordedDates,
  daysAhead = DEFAULT_DAYS_AHEAD,
}: RescheduleArgs): Promise<void> {
  await cancelAllReminders();

  const now = new Date();
  const todayStr = today();

  const tasks: Array<Promise<unknown>> = [];
  for (let i = 0; i < daysAhead; i++) {
    const dateStr = addDays(todayStr, i);
    if (recordedDates.has(dateStr)) continue;

    const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
    const target = new Date(y, m - 1, d, hour, minute, 0, 0);
    if (target.getTime() <= now.getTime()) continue;

    tasks.push(
      Notifications.scheduleNotificationAsync({
        identifier: `${REMINDER_NOTIFICATION_ID_PREFIX}${dateStr}`,
        content: {
          title: '一口日記',
          body: '今日の一文を書きましょう',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: target,
        },
      })
    );
  }
  await Promise.all(tasks);
}
