import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ExportReminderIntervalDays,
  Settings,
  ThemePreference,
} from '../types';
import { DEFAULT_SETTINGS, EXPORT_REMINDER_INTERVALS } from '../types';

const KEYS = {
  lockEnabled: 'settings.lockEnabled',
  reminderEnabled: 'settings.reminderEnabled',
  reminderHour: 'settings.reminderHour',
  reminderMinute: 'settings.reminderMinute',
  viewMode: 'settings.viewMode',
  themePreference: 'settings.themePreference',
  exportReminderEnabled: 'settings.exportReminderEnabled',
  exportReminderIntervalDays: 'settings.exportReminderIntervalDays',
} as const;

function parseBool(v: string | null, def: boolean): boolean {
  if (v === null) return def;
  return v === 'true';
}

function parseNumber(v: string | null, def: number): number {
  if (v === null) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function parseViewMode(
  v: string | null,
  def: 'calendar' | 'timeline'
): 'calendar' | 'timeline' {
  if (v === 'calendar' || v === 'timeline') return v;
  return def;
}

function parseThemePreference(v: string | null, def: ThemePreference): ThemePreference {
  if (v === 'system' || v === 'light' || v === 'dark') return v;
  return def;
}

function parseExportReminderInterval(
  v: string | null,
  def: ExportReminderIntervalDays
): ExportReminderIntervalDays {
  const n = Number(v);
  const found = EXPORT_REMINDER_INTERVALS.find((d) => d === n);
  return found ?? def;
}

export async function loadSettings(): Promise<Settings> {
  const [lock, rem, hour, minute, view, theme, expRem, expInterval] =
    await Promise.all([
      AsyncStorage.getItem(KEYS.lockEnabled),
      AsyncStorage.getItem(KEYS.reminderEnabled),
      AsyncStorage.getItem(KEYS.reminderHour),
      AsyncStorage.getItem(KEYS.reminderMinute),
      AsyncStorage.getItem(KEYS.viewMode),
      AsyncStorage.getItem(KEYS.themePreference),
      AsyncStorage.getItem(KEYS.exportReminderEnabled),
      AsyncStorage.getItem(KEYS.exportReminderIntervalDays),
    ]);
  return {
    lockEnabled: parseBool(lock, DEFAULT_SETTINGS.lockEnabled),
    reminderEnabled: parseBool(rem, DEFAULT_SETTINGS.reminderEnabled),
    reminderHour: parseNumber(hour, DEFAULT_SETTINGS.reminderHour),
    reminderMinute: parseNumber(minute, DEFAULT_SETTINGS.reminderMinute),
    viewMode: parseViewMode(view, DEFAULT_SETTINGS.viewMode),
    themePreference: parseThemePreference(theme, DEFAULT_SETTINGS.themePreference),
    exportReminderEnabled: parseBool(
      expRem,
      DEFAULT_SETTINGS.exportReminderEnabled
    ),
    exportReminderIntervalDays: parseExportReminderInterval(
      expInterval,
      DEFAULT_SETTINGS.exportReminderIntervalDays
    ),
  };
}

export async function saveSettings(s: Settings): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.lockEnabled, String(s.lockEnabled)),
    AsyncStorage.setItem(KEYS.reminderEnabled, String(s.reminderEnabled)),
    AsyncStorage.setItem(KEYS.reminderHour, String(s.reminderHour)),
    AsyncStorage.setItem(KEYS.reminderMinute, String(s.reminderMinute)),
    AsyncStorage.setItem(KEYS.viewMode, s.viewMode),
    AsyncStorage.setItem(KEYS.themePreference, s.themePreference),
    AsyncStorage.setItem(
      KEYS.exportReminderEnabled,
      String(s.exportReminderEnabled)
    ),
    AsyncStorage.setItem(
      KEYS.exportReminderIntervalDays,
      String(s.exportReminderIntervalDays)
    ),
  ]);
}
