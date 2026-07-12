import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExportReminderState } from '../services/exportReminder';

// ユーザー設定 (settingsRepository) とは別物の「状態」なので独立させている。
// Settings 型に混ぜない
const KEYS = {
  lastExportedAt: 'exportReminder.lastExportedAt',
  lastRemindedAt: 'exportReminder.lastRemindedAt',
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(v: string | null): string | null {
  return v !== null && DATE_RE.test(v) ? v : null;
}

export async function loadExportReminderState(): Promise<ExportReminderState> {
  const [exported, reminded] = await Promise.all([
    AsyncStorage.getItem(KEYS.lastExportedAt),
    AsyncStorage.getItem(KEYS.lastRemindedAt),
  ]);
  return {
    lastExportedAt: parseDate(exported),
    lastRemindedAt: parseDate(reminded),
  };
}

export async function setLastExportedAt(date: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.lastExportedAt, date);
}

export async function setLastRemindedAt(date: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.lastRemindedAt, date);
}
