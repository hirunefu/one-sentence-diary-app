import { buildExportJson, exportEntries } from './exportService';
import type { Entry } from '../types';

// The device's files and share sheet. A write lands a moment after it starts,
// as on the device; the share sheet sees what the file holds when it opens.
const mockFiles = new Map<string, string>();
const mockShared: Array<string | undefined> = [];
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache' },
  File: class {
    uri: string;
    constructor(dir: string, name: string) {
      this.uri = `${dir}/${name}`;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    delete() {
      mockFiles.delete(this.uri);
    }
    create() {
      mockFiles.set(this.uri, '');
    }
    write(content: string) {
      return new Promise<void>((resolve) =>
        setTimeout(() => {
          mockFiles.set(this.uri, content);
          resolve();
        }, 0)
      );
    }
  },
}));
jest.mock('expo-sharing', () => ({
  shareAsync: async (uri: string) => {
    mockShared.push(mockFiles.get(uri));
  },
}));

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

describe('exportEntries', () => {
  test('opens the share sheet only once the file holds every Entry', async () => {
    const entries: Entry[] = [
      { date: '2026-04-28', text: 'a', createdAt: 1000, updatedAt: 1000 },
    ];
    await exportEntries(entries, '1.3.0');
    const shared = mockShared.map((content) => {
      try {
        return JSON.parse(content ?? '');
      } catch {
        return content;
      }
    });
    expect(shared).toEqual([expect.objectContaining({ entries })]);
  });
});
