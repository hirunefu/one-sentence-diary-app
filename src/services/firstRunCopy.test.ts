import {
  FIRST_DAY_LINE,
  FIRST_RUN_DOTS,
  FIRST_SAVE_SPOKEN,
  PRIVACY_LINE,
  REMINDER_OFFER_ACCEPT,
  REMINDER_OFFER_ACCEPT_HINT,
  REMINDER_OFFER_DECLINE,
  REMINDER_OFFER_DECLINE_HINT,
  reminderOfferLine,
  reminderSetCopy,
  reminderTime,
} from './firstRunCopy';

// Width of a phrase at 200% on a 360dp phone: full-width characters, a
// half-width one (a digit) counting half. 14 fit on one line.
const width = (s: string) => [...s].reduce((w, c) => w + (/[\x20-\x7e]/.test(c) ? 0.5 : 1), 0);
const phrases = (s: string) => s.replace(/、/g, '、\n').split('\n');

const shown = () => [
  FIRST_RUN_DOTS.shown,
  PRIVACY_LINE,
  FIRST_DAY_LINE,
  reminderOfferLine(21, 0),
  reminderSetCopy(21, 0).line,
  reminderSetCopy(21, 0).note,
];

describe('firstRunCopy', () => {
  test('the dot line says what the dots become, and its spoken form names them', () => {
    expect(FIRST_RUN_DOTS.shown).toBe('書いた日が、この点で埋まっていきます。');
    // The dots are not screen-reader elements: nothing to point at.
    expect(FIRST_RUN_DOTS.spoken).toBe('書いた日が、直近7日の点で埋まっていきます。');
    expect(FIRST_RUN_DOTS.spoken).not.toMatch(/この/);
  });

  // Android's device backup can copy app data, so it never says 「だけ」.
  test('the privacy line says only where Entries are kept', () => {
    expect(PRIVACY_LINE).toBe('記録は、この端末に保存されます。');
    expect(PRIVACY_LINE).not.toMatch(/だけ|安全|暗号|誰にも|完全|絶対|クラウド|同期/);
  });

  test('the first day line explains the Streak, and the first save says it', () => {
    expect(FIRST_DAY_LINE).toBe('1日目。明日も書くと、つながります。');
    expect(FIRST_SAVE_SPOKEN).toBe('保存しました。1日目。明日も書くと、つながります。');
  });

  test('the offer says when a Reminder comes, at the time in the settings', () => {
    expect(reminderOfferLine(21, 0)).toBe('記録のない日は、21時にお知らせしましょうか？');
    expect(reminderOfferLine(7, 30)).toBe('記録のない日は、7時30分にお知らせしましょうか？');
  });

  test('times are written without spaces, minutes only when set', () => {
    expect(reminderTime(21, 0)).toBe('21時');
    expect(reminderTime(7, 5)).toBe('7時5分');
  });

  test('the confirmation says what was set and where to change it', () => {
    const copy = reminderSetCopy(21, 0);
    expect(copy.line).toBe('記録のない日は、21時にお知らせします。');
    expect(copy.note).toBe('時刻は、設定で変えられます。');
    expect(copy.spoken).toBe(`${copy.line}${copy.note}`);
  });

  test('the buttons say what they do', () => {
    expect(REMINDER_OFFER_DECLINE).toBe('いらない');
    expect(REMINDER_OFFER_DECLINE_HINT).toBe('リマインダーはオフのまま、この案内を閉じます');
    expect(REMINDER_OFFER_ACCEPT).toBe('設定する');
    expect(REMINDER_OFFER_ACCEPT_HINT).toBe(
      'リマインダーをオンにします。通知の許可を求める画面が開くことがあります'
    );
  });

  // An offer (〜しましょうか？) is the only form that asks anything.
  test('stays calm', () => {
    const all = [
      ...shown(),
      FIRST_RUN_DOTS.spoken,
      REMINDER_OFFER_DECLINE,
      REMINDER_OFFER_DECLINE_HINT,
      REMINDER_OFFER_ACCEPT,
      REMINDER_OFFER_ACCEPT_HINT,
    ];
    for (const text of all) {
      expect(text).not.toMatch(
        /[！!]|あなた|ください|べき|必ず|毎日|忘れず|続けましょう|しよう|までに|今すぐ|\p{Extended_Pictographic}/u
      );
      expect(text.replace(/しましょうか？/g, '')).not.toMatch(/ましょう/);
    }
  });

  test('every visible phrase fits one line at 200% on a 360dp phone', () => {
    for (const text of shown()) {
      for (const phrase of phrases(text)) expect(width(phrase)).toBeLessThanOrEqual(14);
    }
  });

  test('every line ends as a sentence, or as the offer\'s question', () => {
    for (const text of shown()) expect(text).toMatch(/[。？]$/);
  });
});
