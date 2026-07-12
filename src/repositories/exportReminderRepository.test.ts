import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadExportReminderState,
  setLastExportedAt,
  setLastRemindedAt,
} from './exportReminderRepository';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('exportReminderRepository', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('returns nulls when storage is empty', async () => {
    expect(await loadExportReminderState()).toEqual({
      lastExportedAt: null,
      lastRemindedAt: null,
    });
  });

  test('setLastExportedAt round-trips', async () => {
    await setLastExportedAt('2026-07-12');
    const state = await loadExportReminderState();
    expect(state.lastExportedAt).toBe('2026-07-12');
    expect(state.lastRemindedAt).toBeNull();
  });

  test('setLastRemindedAt round-trips', async () => {
    await setLastRemindedAt('2026-07-12');
    const state = await loadExportReminderState();
    expect(state.lastRemindedAt).toBe('2026-07-12');
    expect(state.lastExportedAt).toBeNull();
  });

  test('malformed stored values are treated as null', async () => {
    await AsyncStorage.setItem('exportReminder.lastExportedAt', 'bogus');
    await AsyncStorage.setItem('exportReminder.lastRemindedAt', '2026/07/12');
    expect(await loadExportReminderState()).toEqual({
      lastExportedAt: null,
      lastRemindedAt: null,
    });
  });
});
