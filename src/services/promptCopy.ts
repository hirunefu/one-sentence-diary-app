// The Prompt (CONTEXT.md): the question of the day, shown as the placeholder
// of Home's empty Entry field and as the body of that day's Reminder, so it is
// never saved.
// Writing rules (the checkable ones are tested in promptCopy.test.ts):
// - one plain-form question about one small, concrete part of today, ending in
//   「？」; ask what or when, never why (Eurich 2018; relive a good moment rather
//   than analyse it: Lyubomirsky, Sousa & Dickerhoof 2006);
// - answerable truthfully in one sentence on a bad day: no superlatives, no
//   affirmations, no requests (Wood et al. 2009; Mauss et al. 2011);
// - assume no job, family, partner, pets, health or senses; no 「あなた」, no
//   humour, slang or emoji (Apple HIG, Inclusion);
// - no weekday, season, weather or holiday: the rotation ignores the calendar;
// - no Streak or habit talk, no promised benefits;
// - at most 20 characters (three lines at 200% font size);
// - gratitude about once a week, varied, and worded as 「助かった」 rather than as a
//   duty to be thankful (Lyubomirsky, Sheldon & Schkade 2005); anticipation at
//   most once (Bryant, Chadwick & Kluwe 2011);
// - neighbours never share a theme group, including the last and the first.
// Editing, adding or reordering Prompts changes which day shows which. That is
// fine: a Prompt is never saved or shown next to a past Entry.
export type PromptTheme = `${'noticing' | 'savoring' | 'care'}/${string}`;
export type Prompt = { readonly text: string; readonly theme: PromptTheme };

// In rotation order: 1970-01-01 shows the first (and so does 2026-09-04).
export const PROMPTS: readonly Prompt[] = [
  { text: 'いま、体はどんな感じ？', theme: 'noticing/mood-body' },
  { text: '今日、ちょうどよかったことは？', theme: 'savoring/small-good' },
  { text: '今日、時間をかけたものは？', theme: 'care/process' },
  { text: '今日、ふと気づいたことは？', theme: 'noticing/observation' },
  { text: '今日、そばにあってよかったものは？', theme: 'savoring/gratitude' },
  { text: '今日、やめておいたことは？', theme: 'care/rest' },
  { text: '今日、心に残った言葉は？', theme: 'noticing/observation' },
  { text: '今日、少しうれしかったことは？', theme: 'savoring/small-good' },
  { text: '今日の自分にひとこと言うなら？', theme: 'care/mood-body' },
  { text: '今日、目にとまったものは？', theme: 'noticing/observation' },
  { text: '今日、続いてほしかった時間は？', theme: 'savoring/small-good' },
  { text: '今日、ていねいにしたことは？', theme: 'care/process' },
  { text: 'いまいる場所はどんな感じ？', theme: 'noticing/observation' },
  { text: '今日、過去の自分に助けられたことは？', theme: 'savoring/gratitude' },
  { text: '今日の気分に名前をつけるなら？', theme: 'care/mood-body' },
  { text: '今日、ふしぎだなと思ったことは？', theme: 'noticing/observation' },
  { text: 'このあとのささやかな楽しみは？', theme: 'savoring/anticipation' },
  { text: '今日、ひとつ済ませたことは？', theme: 'care/process' },
  { text: '今日、なんとなく選んだものは？', theme: 'noticing/observation' },
  { text: '今日、いつもどおりでよかったことは？', theme: 'savoring/gratitude' },
  { text: '今日、ぼんやりした時間は？', theme: 'care/rest' },
  { text: '今日、起きてまず感じたことは？', theme: 'noticing/mood-body' },
  { text: '今日、好きだなと思ったものは？', theme: 'savoring/small-good' },
  { text: '今日、少し工夫したことは？', theme: 'care/process' },
  { text: '今日のひとこまを残すなら？', theme: 'noticing/observation' },
  { text: '今日、助かったことは？', theme: 'savoring/gratitude' },
  { text: '今日、ひと息ついたのはどんなとき？', theme: 'care/rest' },
  { text: '今日、久しぶりだったことは？', theme: 'noticing/change' },
  { text: '今日、心地よかったものは？', theme: 'savoring/small-good' },
  { text: '今日、自分のためにしたことは？', theme: 'care/process' },
];

const DAY_MS = 86_400_000;

// Whole days since 1970-01-01, from the date's own year, month and day, so
// neither the time zone nor a DST change can move it.
function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

// One Prompt per calendar day, in list order, starting again after the last.
// It depends on the date alone (no re-roll, no stored state), so it stays the
// same all day and changes with the date at midnight.
export function promptFor(date: string): string {
  const n = PROMPTS.length;
  return (PROMPTS[((dayNumber(date) % n) + n) % n] as Prompt).text;
}
