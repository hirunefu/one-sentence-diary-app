// String's for...of iterates by Unicode code point, so a single visible
// character backed by a surrogate pair (emoji, some combining marks) still
// counts as 1. Using `text.length` (UTF-16 code units) would make
// "🌸".length === 2, breaking the user's expectation of the 140-char limit.
export function countChars(text: string): number {
  let count = 0;
  for (const _ of text) {
    count++;
  }
  return count;
}

export function truncate(text: string, max: number): string {
  if (max <= 0) return '';
  let count = 0;
  let result = '';
  for (const ch of text) {
    if (count >= max) break;
    result += ch;
    count++;
  }
  return result;
}

export function stripNewlines(text: string): string {
  return text.replace(/[\r\n]/g, '');
}
