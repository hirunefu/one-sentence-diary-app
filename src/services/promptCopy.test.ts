import { PROMPTS, promptFor } from './promptCopy';
import { addDays } from '../utils/date';
import { countChars } from '../utils/text';

const n = PROMPTS.length;
const indexOn = (date: string) => PROMPTS.findIndex((p) => p.text === promptFor(date));
const group = (i: number) => PROMPTS[i]?.theme.split('/')[0];

describe('promptFor', () => {
  test('the list starts on 1970-01-01 and comes round again every PROMPTS.length days', () => {
    expect(promptFor('1970-01-01')).toBe(PROMPTS[0]?.text);
    expect(promptFor(addDays('1970-01-01', n))).toBe(PROMPTS[0]?.text);
    expect(promptFor(addDays('1970-01-01', -1))).toBe(PROMPTS[n - 1]?.text);
  });

  test('each day brings the next Prompt, and the last is followed by the first', () => {
    let day = '2026-09-25';
    for (let i = 0; i < n * 2; i++) {
      const next = addDays(day, 1);
      expect(indexOn(next)).toBe((indexOn(day) + 1) % n);
      day = next;
    }
  });

  test('every Prompt comes up once in any run of PROMPTS.length days', () => {
    const run = Array.from({ length: n }, (_, i) => promptFor(addDays('2026-09-25', i)));
    expect(new Set(run).size).toBe(n);
  });

  test('no seam at a month end, the year end or a leap day', () => {
    for (const [a, b] of [
      ['2024-02-28', '2024-02-29'],
      ['2024-02-29', '2024-03-01'],
      ['2026-03-28', '2026-03-29'],
      ['2026-03-31', '2026-04-01'],
      ['2026-10-24', '2026-10-25'],
      ['2026-12-31', '2027-01-01'],
    ] as const) {
      expect(indexOn(b)).toBe((indexOn(a) + 1) % n);
    }
  });
});

// The writing rules that can be checked. The rest are in promptCopy.ts.
describe('PROMPTS', () => {
  test('every Prompt is one short, plain question', () => {
    for (const { text } of PROMPTS) {
      expect(text).toMatch(/^[^\r\n]+？$/);
      expect(countChars(text)).toBeLessThanOrEqual(20);
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(text).not.toMatch(/[！!]|あなた/);
      expect(text).not.toMatch(/なぜ|どうして/); // what, not why
      expect(text).not.toMatch(/しよう|ましょう|ください|ますか|ですか/); // no requests, no です/ます
      expect(text).not.toMatch(/連続|毎日|続けよう|最高|いちばん|一番/); // no habit talk, no peaks
    }
  });

  test('no Prompt repeats', () => {
    expect(new Set(PROMPTS.map((p) => p.text)).size).toBe(n);
  });

  test('the count is not a multiple of 7, so no Prompt keeps to one weekday', () => {
    expect(n % 7).not.toBe(0);
  });

  test('neighbours never share a theme group, including the last and the first', () => {
    for (let i = 0; i < n; i++) expect(group(i)).not.toBe(group((i + 1) % n));
  });

  test('gratitude about once a week, anticipation at most once', () => {
    const count = (focus: string) => PROMPTS.filter((p) => p.theme.endsWith(`/${focus}`)).length;
    expect(count('gratitude')).toBeLessThanOrEqual(Math.floor(n / 7));
    expect(count('anticipation')).toBeLessThanOrEqual(1);
  });
});
