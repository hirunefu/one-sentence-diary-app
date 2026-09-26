// What Home says to a first-time user, from before the first Entry to the one
// Reminder offer. Never shown to a returning user (EntriesContext `firstRun`,
// ADR 0002).
// Rules (the checkable ones are tested in firstRunCopy.test.ts):
// - plain statements of fact, or one offer (〜しましょうか？); no request, no
//   deadline, no loss or guilt, no Streak pressure (毎日, 続けましょう, 忘れずに),
//   no promised benefit, never a claim that a habit has formed;
// - no 「あなた」, no exclamation marks, no emoji;
// - every visible phrase (text between 「、」s) fits one line at 200% on a
//   360dp phone: at most 14 full-width characters, a digit counting half;
//   every line ends in 「。」, or in 「？」 for the offer;
// - digits and 時/分 without spaces (「21時」: JTF style guide 4.0).

// Under the Streak's dots while there is no Entry. The dots are not TalkBack
// nodes, so the spoken form names them by their visible label (WCAG 1.3.3).
export const FIRST_RUN_DOTS = {
  shown: '書いた日が、この点で埋まっていきます。',
  spoken: '書いた日が、直近7日の点で埋まっていきます。',
} as const;

// At the bottom of Home while there is no Entry, just before the first save
// (privacy shown at the point of decision: Tsai et al. 2011). Only where
// Entries are kept: never 「だけ」, since Android's device backup may copy app
// data, and no assurance words (安全, 暗号化, 誰にも見られません), which can
// read as a warning (Singer, Hippler & Schwarz 1992).
export const PRIVACY_LINE = '記録は、この端末に保存されます。';

// Under the Streak for the rest of the first day, while that day's Entry is
// the only one. The one place that mentions tomorrow: a condition that
// explains the Streak when it first counts, not a request (celebrationCopy
// keeps its "nothing about tomorrow" rule). No N+1, no next Milestone, never
// 「明日から」.
export const FIRST_DAY_LINE = '1日目。明日も書くと、つながります。';
// The existing save announcement, for the save that makes the first Entry.
export const FIRST_SAVE_SPOKEN = `保存しました。${FIRST_DAY_LINE}`;

// The Reminder offer: once, on a first-time user's first day on Home. Says
// exactly when a Reminder comes (CONTEXT.md: only on a day with no Entry yet),
// at the time in the settings. An offer, never a request; the decline stays
// neutral, never confirmshaming (Mathur et al. 2019).
export function reminderTime(hour: number, minute: number): string {
  return minute === 0 ? `${hour}時` : `${hour}時${minute}分`;
}
export function reminderOfferLine(hour: number, minute: number): string {
  return `記録のない日は、${reminderTime(hour, minute)}にお知らせしましょうか？`;
}
export const REMINDER_OFFER_DECLINE = 'いらない';
export const REMINDER_OFFER_DECLINE_HINT = 'リマインダーはオフのまま、この案内を閉じます';
export const REMINDER_OFFER_ACCEPT = '設定する';
// Android's own screen does not open on Android 12 and lower, nor when
// notifications are already allowed.
export const REMINDER_OFFER_ACCEPT_HINT =
  'リマインダーをオンにします。通知の許可を求める画面が開くことがあります';

// After 設定する turned Reminders on: what was set, and where to change it
// (the 設定 tab).
export function reminderSetCopy(hour: number, minute: number) {
  const line = `記録のない日は、${reminderTime(hour, minute)}にお知らせします。`;
  const note = '時刻は、設定で変えられます。';
  return { line, note, spoken: `${line}${note}` };
}
