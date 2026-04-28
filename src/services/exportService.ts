import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Entry } from '../types';
import { today } from '../utils/date';

export function buildExportJson(
  entries: Entry[],
  exportedAt: string,
  appVersion: string
): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt,
      appVersion,
      entries,
    },
    null,
    2
  );
}

export async function exportEntries(
  entries: Entry[],
  appVersion: string
): Promise<void> {
  const json = buildExportJson(entries, new Date().toISOString(), appVersion);
  const fileName = `diary_${today()}.json`;
  const file = new File(Paths.cache, fileName);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(json);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: '一文日記をエクスポート',
    UTI: 'public.json',
  });
}
