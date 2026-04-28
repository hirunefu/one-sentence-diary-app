import { buildExportJson } from './exportService';
import type { Entry } from '../types';

describe('buildExportJson', () => {
  test('produces v1 schema with entries in date desc order', () => {
    const entries: Entry[] = [
      { date: '2026-04-28', text: 'a', createdAt: 1000, updatedAt: 1000 },
      { date: '2026-04-27', text: 'b', createdAt: 900, updatedAt: 900 },
    ];
    const json = buildExportJson(entries, '2026-04-28T12:34:56.789Z', '1.0.0');
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toBe('2026-04-28T12:34:56.789Z');
    expect(parsed.appVersion).toBe('1.0.0');
    expect(parsed.entries).toEqual(entries);
  });

  test('handles empty entries list', () => {
    const json = buildExportJson([], '2026-04-28T00:00:00.000Z', '1.0.0');
    expect(JSON.parse(json).entries).toEqual([]);
  });
});
