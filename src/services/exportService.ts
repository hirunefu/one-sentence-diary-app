import * as FileSystem from 'expo-file-system';
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
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: '一文日記をエクスポート',
    UTI: 'public.json',
  });
}
