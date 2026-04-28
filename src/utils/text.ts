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
