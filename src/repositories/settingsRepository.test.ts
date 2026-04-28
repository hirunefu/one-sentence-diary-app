import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadSettings, saveSettings } from './settingsRepository';
import { DEFAULT_SETTINGS } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('settingsRepository', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('loadSettings returns defaults when storage is empty', async () => {
    const s = await loadSettings();
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  test('saveSettings then loadSettings round-trips all fields', async () => {
    const next = {
      lockEnabled: true,
      reminderEnabled: true,
      reminderHour: 8,
      reminderMinute: 30,
      viewMode: 'timeline' as const,
    };
    await saveSettings(next);
    expect(await loadSettings()).toEqual(next);
  });

  test('partial pre-existing data is filled with defaults for missing keys', async () => {
    await AsyncStorage.setItem('settings.reminderHour', '7');
    const s = await loadSettings();
    expect(s.reminderHour).toBe(7);
    expect(s.lockEnabled).toBe(false);
    expect(s.viewMode).toBe('calendar');
  });
});
