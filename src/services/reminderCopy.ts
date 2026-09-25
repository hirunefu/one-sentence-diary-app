import { promptFor } from './promptCopy';

// What a Reminder says (CONTEXT.md: a notification, at the user's chosen time,
// on a day that has no Entry yet). The shade, the lock screen and TalkBack read
// it as one: title, then body.
// Rules (the checkable ones are tested in reminderCopy.test.ts):
// - The title is always 「今日の一文」, the label of Home's Entry field, so the
//   tap opens the thing it names. No app name (Android shows it in the header),
//   no number, no date, no final 「。」.
// - The body is the Prompt of the Reminder's own date: the question Home shows
//   after the tap. Repeated reminders wear out (Kocielnik & Hsieh 2017; Yancey &
//   Settles 2020), and the Prompts don't repeat within the 14 days scheduled.
//   It depends on the date alone, so a Reminder scheduled days ahead never goes
//   stale, and the same date always gives the same text.
// - Only the nearest scheduled Reminder may carry the Streak: the number Home
//   will show on that day, in Home's own words 「N日連続。」, first, and only from
//   STREAK_IN_REMINDER_MIN (people start to see a streak at three: Carlson &
//   Shu 2007). Later Reminders never carry it: it could change before they fire.
// - The number is information, not a stake (Deci, Koestner & Ryan 1999):
//   nothing ties it to writing today, no N+1, no next Milestone, no Longest
//   streak, and never a broken Streak (Silverman & Barasch 2023).
// - No requests, deadlines, guilt, loss or come-back words; no 「あなた」, no
//   exclamation marks, no emoji, never Entry text.
export const REMINDER_TITLE = '今日の一文';
export const STREAK_IN_REMINDER_MIN = 3;

export type ReminderCopy = { readonly title: string; readonly body: string };

// streak: the Streak Home will show on `date`, for the nearest scheduled
// Reminder only; null for every later one.
export function reminderFor(date: string, streak: number | null): ReminderCopy {
  const prompt = promptFor(date);
  const body =
    streak !== null && streak >= STREAK_IN_REMINDER_MIN ? `${streak}日連続。${prompt}` : prompt;
  return { title: REMINDER_TITLE, body };
}
