export type Entry = {
  date: string;
  text: string;
  createdAt: number;
  updatedAt: number;
};

export type ThemePreference = 'system' | 'light' | 'dark';

export const EXPORT_REMINDER_INTERVALS = [1, 3, 7, 14, 30] as const;

export type ExportReminderIntervalDays =
  (typeof EXPORT_REMINDER_INTERVALS)[number];

export type Settings = {
  lockEnabled: boolean;
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  viewMode: 'calendar' | 'timeline';
  themePreference: ThemePreference;
  exportReminderEnabled: boolean;
  exportReminderIntervalDays: ExportReminderIntervalDays;
};

export const DEFAULT_SETTINGS: Settings = {
  lockEnabled: false,
  reminderEnabled: false,
  reminderHour: 21,
  reminderMinute: 0,
  viewMode: 'calendar',
  themePreference: 'system',
  // データは端末ローカルのみで消失リスクが高いため、他の設定と違い
  // エクスポートリマインドだけはオプトアウト方式 (デフォルト有効)
  exportReminderEnabled: true,
  exportReminderIntervalDays: 7,
};

export const MAX_TEXT_LENGTH = 140;
