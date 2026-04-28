import { countChars, truncate, stripNewlines } from './text';

describe('countChars', () => {
  test('returns 0 for empty string', () => {
    expect(countChars('')).toBe(0);
  });

  test('counts ASCII characters as 1 each', () => {
    expect(countChars('hello')).toBe(5);
  });

  test('counts hiragana as 1 each', () => {
    expect(countChars('こんにちは')).toBe(5);
  });

  test('counts kanji (BMP) as 1 each', () => {
    expect(countChars('日本語')).toBe(3);
  });

  test('counts emoji (surrogate pair) as 1', () => {
    expect(countChars('😀')).toBe(1);
  });

  test('counts mixed text correctly', () => {
    expect(countChars('Hi😀こん')).toBe(5);
  });
});

describe('truncate', () => {
  test('returns original if within limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  test('truncates ASCII at exactly the limit', () => {
    expect(truncate('hello world', 5)).toBe('hello');
  });

  test('truncates emoji safely (no broken surrogate)', () => {
    expect(truncate('a😀b😀c', 3)).toBe('a😀b');
  });

  test('returns empty if max is 0', () => {
    expect(truncate('hello', 0)).toBe('');
  });
});

describe('stripNewlines', () => {
  test('returns unchanged if no newlines', () => {
    expect(stripNewlines('hello world')).toBe('hello world');
  });

  test('removes \\n', () => {
    expect(stripNewlines('hello\nworld')).toBe('helloworld');
  });

  test('removes \\r\\n and \\r', () => {
    expect(stripNewlines('a\r\nb\rc')).toBe('abc');
  });
});
