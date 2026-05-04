import { parseImportJson, ImportParseError } from './importService';

describe('parseImportJson', () => {
  test('正常な JSON を受け取ると { version, entries } を返す', () => {
    const raw = JSON.stringify({
      version: 1,
      exportedAt: '2026-04-30T00:00:00.000Z',
      appVersion: '1.0.0',
      entries: [
        { date: '2026-04-30', text: 'hello', createdAt: 1, updatedAt: 1 },
      ],
    });
    const parsed = parseImportJson(raw);
    expect(parsed.version).toBe(1);
    expect(parsed.entries).toHaveLength(1);
  });

  test('JSON として不正なら ImportParseError(code=invalid-json) を投げる', () => {
    expect(() => parseImportJson('not json')).toThrow(ImportParseError);
    try {
      parseImportJson('not json');
    } catch (e) {
      expect((e as ImportParseError).code).toBe('invalid-json');
    }
  });

  test('object でなければ invalid-structure', () => {
    try {
      parseImportJson(JSON.stringify([1, 2, 3]));
      fail('should throw');
    } catch (e) {
      expect((e as ImportParseError).code).toBe('invalid-structure');
    }
  });

  test('version !== 1 なら unsupported-version', () => {
    try {
      parseImportJson(JSON.stringify({ version: 2, entries: [] }));
      fail('should throw');
    } catch (e) {
      expect((e as ImportParseError).code).toBe('unsupported-version');
    }
  });

  test('entries が配列でなければ invalid-structure', () => {
    try {
      parseImportJson(JSON.stringify({ version: 1, entries: 'oops' }));
      fail('should throw');
    } catch (e) {
      expect((e as ImportParseError).code).toBe('invalid-structure');
    }
  });
});

import { classifyEntries } from './importService';

describe('classifyEntries', () => {
  const existingDates = new Set(['2026-04-29']);

  test('有効・新規・重複・不正を正しく分類する', () => {
    const raw = [
      { date: '2026-04-30', text: 'new', createdAt: 1, updatedAt: 1 },
      { date: '2026-04-29', text: 'dup', createdAt: 1, updatedAt: 1 },
      { date: '2026-13-01', text: 'bad date', createdAt: 1, updatedAt: 1 },
      { date: '2026-04-28', text: '', createdAt: 1, updatedAt: 1 },
      { date: '2026-04-27', text: 'a\nb', createdAt: 1, updatedAt: 1 },
      { date: '2026-04-26', text: 'x'.repeat(141), createdAt: 1, updatedAt: 1 },
      { date: '2026-04-25', text: 'no time', createdAt: 'oops', updatedAt: 1 },
      'not an object',
      null,
    ];
    const r = classifyEntries(raw, existingDates);
    expect(r.newEntries).toEqual([
      { date: '2026-04-30', text: 'new', createdAt: 1, updatedAt: 1 },
    ]);
    expect(r.conflicts).toEqual([
      { date: '2026-04-29', text: 'dup', createdAt: 1, updatedAt: 1 },
    ]);
    expect(r.invalid).toBe(7);
  });

  test('140 字ちょうどは有効、surrogate pair も 1 codepoint と数える', () => {
    const text = 'あ'.repeat(140);
    const r = classifyEntries(
      [{ date: '2026-04-30', text, createdAt: 1, updatedAt: 1 }],
      new Set()
    );
    expect(r.newEntries).toHaveLength(1);
  });

  test('絵文字 (surrogate pair) は 1 codepoint としてカウントされる', () => {
    const text = '😀'.repeat(140);
    const r = classifyEntries(
      [{ date: '2026-04-30', text, createdAt: 1, updatedAt: 1 }],
      new Set()
    );
    expect(r.newEntries).toHaveLength(1);
  });

  test('CR (\\r) も改行として不正扱い', () => {
    const r = classifyEntries(
      [{ date: '2026-04-30', text: 'a\rb', createdAt: 1, updatedAt: 1 }],
      new Set()
    );
    expect(r.newEntries).toHaveLength(0);
    expect(r.invalid).toBe(1);
  });

  test('空配列を渡すと全部 0', () => {
    const r = classifyEntries([], new Set());
    expect(r.newEntries).toEqual([]);
    expect(r.conflicts).toEqual([]);
    expect(r.invalid).toBe(0);
  });
});
