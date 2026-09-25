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
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
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

export function cancelAllReminders(): Promise<void> {
  return inTurn(cancelScheduledReminders);
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
  await dismissStaleReminders(todayStr, recordedDates, datesDesc);

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
  });
  // Only Reminders ever used it.
  if (fallback !== null) await Notifications.deleteNotificationChannelAsync(FALLBACK_CHANNEL_ID);
}

// A Reminder in the shade stays until it is dismissed, and it says 今日. So it
// goes once its day has passed or has an Entry, or when its number is no
// longer the one Home shows (an Entry inside the Streak was deleted).
async function dismissStaleReminders(
  todayStr: string,
  recordedDates: ReadonlySet<string>,
  datesDesc: readonly string[]
): Promise<void> {
  const shown = await Notifications.getPresentedNotificationsAsync();
  const plain = reminderFor(todayStr, null).body;
  const current = reminderFor(todayStr, calculateStreak(datesDesc, todayStr)).body;
  const stale = shown.filter(({ request: { identifier, content } }) => {
    if (!identifier.startsWith(REMINDER_NOTIFICATION_ID_PREFIX)) return false;
    const date = identifier.slice(REMINDER_NOTIFICATION_ID_PREFIX.length);
    if (date < todayStr || recordedDates.has(date)) return true;
    return content.body !== plain && content.body !== current;
  });
  await Promise.all(
    stale.map((n) => Notifications.dismissNotificationAsync(n.request.identifier))
  );
}
