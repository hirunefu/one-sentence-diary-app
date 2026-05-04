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
