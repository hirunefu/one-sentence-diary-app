import * as Notifications from 'expo-notifications';
import { IS_E2E } from '../config/e2eMode';
import { addDays, today } from '../utils/date';
import { calculateStreak } from '../utils/streak';
import { reminderFor } from './reminderCopy';

export const REMINDER_NOTIFICATION_ID_PREFIX = 'daily-reminder-';
// 旧バージョンが使っていた単一 DAILY 通知の ID。アップグレード時のクリーンアップ用。
export const LEGACY_REMINDER_ID = 'daily-reminder';
export const DEFAULT_DAYS_AHEAD = 14;

// Reminders have their own channel, named as the user knows them, at DEFAULT
// importance: Android lists task reminders there (sound, no heads-up banner).
export const REMINDER_CHANNEL_ID = 'reminder';
export const REMINDER_CHANNEL_NAME = 'リマインダー';
export const REMINDER_CHANNEL_DESCRIPTION = '記録のない日に、設定した時刻に届きます';
// Expo's own channel ("Miscellaneous", HIGH), which Reminders used before.
export const FALLBACK_CHANNEL_ID = 'expo_notifications_fallback_notification_channel';

export async function requestNotificationPermission(): Promise<boolean> {
  // E2E build: pretend permission is granted, no OS dialog to drive.
  if (IS_E2E) return true;
  // Android opens its permission screen even when there is nothing to ask,
  // which pauses the app (and re-locks it behind the app lock).
  if ((await Notifications.getPermissionsAsync()).status === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export type NotificationPermission = 'granted' | 'askable' | 'blocked';
// 'blocked': refused for good. On Android 13 and later Expo records that only
// when this app asked, so a refusal from outside the app reads as 'askable'
// (asking then shows nothing). On Android 12 and lower it means the app's
// notifications are turned off in the system settings: not offered to
// someone who turned them off.
export async function notificationPermission(): Promise<NotificationPermission> {
  if (IS_E2E) return 'askable';
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  return canAskAgain ? 'askable' : 'blocked';
}

// Passes run one after another, in call order, so a pass built from older
// Entries (or one that schedules after Reminders were turned off) never writes
// last.
let lastPass: Promise<void> = Promise.resolve();
function inTurn(pass: () => Promise<void>): Promise<void> {
  const run = lastPass.then(pass);
  lastPass = run.catch(() => undefined);
  return run;
}

// Turning Reminders off also takes the ones already in the shade away: with
// no pass to correct them, they would stay and go stale.
export function cancelAllReminders(): Promise<void> {
  return inTurn(async () => {
    await cancelScheduledReminders();
    await dismissShownReminders(() => true);
  });
}

// Not queued: a pass calls it from inside its turn.
async function cancelScheduledReminders(): Promise<void> {
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

export function rescheduleReminders(args: RescheduleArgs): Promise<void> {
  // E2E build: skip everything. Reminder toggling is verified through the
  // SettingsScreen UI flow, not the underlying scheduling.
  if (IS_E2E) return Promise.resolve();
  return inTurn(() => reschedule(args));
}

async function reschedule({
  hour,
  minute,
  recordedDates,
  daysAhead = DEFAULT_DAYS_AHEAD,
}: RescheduleArgs): Promise<void> {
  await ensureReminderChannel();
  await cancelScheduledReminders();

  const todayStr = today();
  const datesDesc = [...recordedDates].sort().reverse();
  // A Reminder in the shade stays until it is dismissed, and it says 今日. So it
  // goes once its day has passed or has an Entry, or when its number is no
  // longer the one Home shows (an Entry inside the Streak was deleted).
  // Known limit: this only runs in a pass, and passes need the app in front
  // (JS timers pause in the background). A Reminder left in the shade stays
  // into the next day, with its 「N日連続。」, until the app is next opened.
  // Expiring it at its midnight would need NotificationCompat's
  // setTimeoutAfter, which expo-notifications does not expose.
  const plain = reminderFor(todayStr, null).body;
  const current = reminderFor(todayStr, calculateStreak(datesDesc, todayStr)).body;
  await dismissShownReminders(
    (date, body) =>
      date < todayStr || recordedDates.has(date) || (body !== plain && body !== current)
  );

  const now = new Date();
  const tasks: Array<Promise<unknown>> = [];
  let nearest = true;
  for (let i = 0; i < daysAhead; i++) {
    const dateStr = addDays(todayStr, i);
    if (recordedDates.has(dateStr)) continue;

    const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
    const target = new Date(y, m - 1, d, hour, minute, 0, 0);
    if (target.getTime() <= now.getTime()) continue;

    // Only the nearest Reminder carries the Streak: the number Home will show
    // on its day. A later one's number could change before it fires.
    const { title, body } = reminderFor(
      dateStr,
      nearest ? calculateStreak(datesDesc, dateStr) : null
    );
    nearest = false;
    tasks.push(
      Notifications.scheduleNotificationAsync({
        identifier: `${REMINDER_NOTIFICATION_ID_PREFIX}${dateStr}`,
        content: { title, body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: target,
          channelId: REMINDER_CHANNEL_ID,
        },
      })
    );
  }
  await Promise.all(tasks);
}

// The channel must exist before a trigger names it (Expo falls back to its own
// channel otherwise). Once a channel exists the user owns its settings, so a
// user who turned the old channel down keeps that.
async function ensureReminderChannel(): Promise<void> {
  const fallback = await Notifications.getNotificationChannelAsync(FALLBACK_CHANNEL_ID);
  const lowered =
    fallback !== null &&
    fallback.importance >= Notifications.AndroidImportance.NONE &&
    fallback.importance < Notifications.AndroidImportance.DEFAULT;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: REMINDER_CHANNEL_NAME,
    description: REMINDER_CHANNEL_DESCRIPTION,
    importance: lowered ? fallback.importance : Notifications.AndroidImportance.DEFAULT,
    // Expo's channel vibrated; a sound set to None there stays off.
    enableVibrate: fallback?.enableVibrate ?? true,
    ...(fallback?.sound === null ? { sound: null } : {}),
  });
  // Only Reminders ever used it.
  if (fallback !== null) await Notifications.deleteNotificationChannelAsync(FALLBACK_CHANNEL_ID);
}

async function dismissShownReminders(
  isStale: (date: string, body: string | null) => boolean
): Promise<void> {
  const shown = await Notifications.getPresentedNotificationsAsync();
  const stale = shown.filter(
    ({ request: { identifier, content } }) =>
      identifier.startsWith(REMINDER_NOTIFICATION_ID_PREFIX) &&
      isStale(identifier.slice(REMINDER_NOTIFICATION_ID_PREFIX.length), content.body)
  );
  await Promise.all(
    stale.map((n) => Notifications.dismissNotificationAsync(n.request.identifier))
  );
}
