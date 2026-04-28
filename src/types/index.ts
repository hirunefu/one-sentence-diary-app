export type Entry = {
  date: string;
  text: string;
  createdAt: number;
  updatedAt: number;
};

export type Settings = {
  lockEnabled: boolean;
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  viewMode: 'calendar' | 'timeline';
};

export const DEFAULT_SETTINGS: Settings = {
  lockEnabled: false,
  reminderEnabled: false,
  reminderHour: 21,
  reminderMinute: 0,
  viewMode: 'calendar',
};

export const MAX_TEXT_LENGTH = 140;
