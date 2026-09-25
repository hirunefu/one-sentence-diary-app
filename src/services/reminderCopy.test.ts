import { REMINDER_TITLE, STREAK_IN_REMINDER_MIN, reminderFor } from './reminderCopy';
import { promptFor } from './promptCopy';
import { addDays } from '../utils/date';
import { countChars } from '../utils/text';

const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

describe('reminderFor', () => {
  test("every Reminder has the same short title, Home's field label", () => {
    for (const date of days('2026-09-01', 60)) {
      for (const streak of [null, 0, STREAK_IN_REMINDER_MIN, 100]) {
        const { title } = reminderFor(date, streak);
        expect(title).toBe('今日の一文');
        expect(countChars(title)).toBeLessThanOrEqual(8);
        expect(title).not.toMatch(/。$|一口日記|\d/);
      }
    }
  });

  test("without a Streak, the body is the Prompt of the Reminder's own date", () => {
    for (const date of days('2026-09-01', 60)) {
      expect(reminderFor(date, null).body).toBe(promptFor(date));
    }
  });

  test('below the minimum, the body shows no number', () => {
    for (let n = 0; n < STREAK_IN_REMINDER_MIN; n++) {
      expect(reminderFor('2026-09-25', n).body).toBe(promptFor('2026-09-25'));
    }
  });

  test('from the minimum, the body is 「N日連続。」 then the Prompt', () => {
    for (const n of [STREAK_IN_REMINDER_MIN, STREAK_IN_REMINDER_MIN + 1, 99, 365, 1000]) {
      expect(reminderFor('2026-09-25', n).body).toBe(`${n}日連続。${promptFor('2026-09-25')}`);
    }
  });

  // No request, deadline, guilt, loss or come-back word; nothing that ties the
  // number to writing today. The Prompts keep their own rules in promptCopy.ts.
  test('the words around the Prompt stay calm', () => {
    const forbidden =
      /[！!\r\n]|あなた|ましょう|ください|ませんか|べき|まだ|忘れ|途切れ|失|リセット|あと|今日中|までに|最後|チャンス|久しぶり|今日も|ので|ために|最長|節目|昨日|\p{Extended_Pictographic}/u;
    for (const date of days('2026-09-01', 30)) {
      const frame = reminderFor(date, 12).body.replace(promptFor(date), '');
      expect(REMINDER_TITLE).not.toMatch(forbidden);
      expect(frame).not.toMatch(forbidden);
    }
  });

  test('neighbouring days never get the same body', () => {
    for (const date of days('2026-09-01', 60)) {
      for (const streak of [null, 12]) {
        expect(reminderFor(addDays(date, 1), streak).body).not.toBe(reminderFor(date, streak).body);
      }
    }
  });

  test('the number comes first and the body stays short', () => {
    for (const date of days('2026-09-01', 30)) {
      const { body } = reminderFor(date, 99);
      expect(body.startsWith('99日連続。')).toBe(true);
      expect(countChars(body)).toBeLessThanOrEqual(24);
    }
  });
});
