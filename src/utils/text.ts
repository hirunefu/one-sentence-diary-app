// String の for...of は Unicode コードポイント単位でイテレートするため、
// 絵文字や結合文字を含む 1 文字 = サロゲートペアでも 1 とカウントできる。
// `text.length` (UTF-16 code unit 数) を使うと "🌸".length === 2 になり、
// 140 字制限が直感とズレるので避ける。
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
