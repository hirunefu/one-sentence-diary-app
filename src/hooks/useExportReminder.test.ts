import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useExportReminder } from './useExportReminder';
import { exportEntries } from '../services/exportService';
import { loadExportReminderState } from '../repositories/exportReminderRepository';
import { addDays, today } from '../utils/date';
import { DEFAULT_SETTINGS, type Entry, type Settings } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../services/exportService', () => ({
  exportEntries: jest.fn().mockResolvedValue(undefined),
}));

const initialEntries: Entry[] = [
  { date: '2026-07-12', text: 'a', createdAt: 1, updatedAt: 1 },
];
let mockEntries: Entry[] = initialEntries;
let mockSettings: Settings = { ...DEFAULT_SETTINGS };

jest.mock('../contexts/EntriesContext', () => ({
  useEntries: () => ({ entries: mockEntries }),
}));
jest.mock('../contexts/SettingsContext', () => ({
  useSettings: () => ({ settings: mockSettings }),
}));

const exportEntriesMock = exportEntries as jest.MockedFunction<
  typeof exportEntries
>;

describe('useExportReminder', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockSettings = { ...DEFAULT_SETTINGS };
    mockEntries = initialEntries;
    exportEntriesMock.mockClear();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  async function remindWithElapsedBaseline(): Promise<{
    pressButton: (label: string) => Promise<void>;
  }> {
    const { result } = await renderHook(() => useExportReminder());
    let promise: Promise<void> = Promise.resolve();
    await act(() => {
      promise = result.current.remindAfterSave(today());
    });
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
    return {
      pressButton: async (label: string) => {
        const button = buttons.find((b) => b.text === label);
        if (!button) throw new Error(`button not found: ${label}`);
        await act(async () => {
          await button.onPress?.();
          await promise;
        });
      },
    };
  }

  test('records only the reminded date when the user chooses later', async () => {
    await AsyncStorage.setItem(
      'exportReminder.lastExportedAt',
      addDays(today(), -8)
    );
    const { pressButton } = await remindWithElapsedBaseline();
    await pressButton('あとで');

    expect(exportEntriesMock).not.toHaveBeenCalled();
    const state = await loadExportReminderState();
    expect(state.lastRemindedAt).toBe(today());
    expect(state.lastExportedAt).toBe(addDays(today(), -8));
  });

  test('exports and records the export date when the user chooses export', async () => {
    await AsyncStorage.setItem(
      'exportReminder.lastExportedAt',
      addDays(today(), -8)
    );
    const { pressButton } = await remindWithElapsedBaseline();
    await pressButton('エクスポート');

    expect(exportEntriesMock).toHaveBeenCalledWith(
      mockEntries,
      expect.any(String)
    );
    const state = await loadExportReminderState();
    expect(state.lastExportedAt).toBe(today());
  });

  test('exports the Entry that was just saved', async () => {
    await AsyncStorage.setItem(
      'exportReminder.lastExportedAt',
      addDays(today(), -8)
    );
    const { result, rerender } = await renderHook(() => useExportReminder());
    // The save handler holds the reminder from the render before the save.
    const remindAfterSave = result.current.remindAfterSave;
    const saved: Entry = {
      date: today(),
      text: 'just saved',
      createdAt: 2,
      updatedAt: 2,
    };
    mockEntries = [...initialEntries, saved];
    await rerender({});

    let promise: Promise<void> = Promise.resolve();
    await act(() => {
      promise = remindAfterSave(today());
    });
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
    await act(async () => {
      await buttons.find((b) => b.text === 'エクスポート')?.onPress?.();
      await promise;
    });

    expect(exportEntriesMock).toHaveBeenCalledWith(
      [...initialEntries, saved],
      expect.any(String)
    );
  });

  test('a reminder started before the setting was turned off does not prompt', async () => {
    await AsyncStorage.setItem(
      'exportReminder.lastExportedAt',
      addDays(today(), -8)
    );
    const { result, rerender } = await renderHook(() => useExportReminder());
    // Held by a save handler (or queued behind a celebration) from before.
    const remindAfterSave = result.current.remindAfterSave;
    mockSettings = { ...DEFAULT_SETTINGS, exportReminderEnabled: false };
    await rerender({});

    let settled = false;
    await act(async () => {
      void remindAfterSave(today()).then(() => {
        settled = true;
      });
    });
    await waitFor(() => expect(settled || alertSpy.mock.calls.length > 0).toBe(true));
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('does not prompt when the reminder is disabled', async () => {
    mockSettings = { ...DEFAULT_SETTINGS, exportReminderEnabled: false };
    await AsyncStorage.setItem(
      'exportReminder.lastExportedAt',
      addDays(today(), -100)
    );
    const { result } = await renderHook(() => useExportReminder());
    await act(async () => {
      await result.current.remindAfterSave(today());
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('exportNow exports and records the export date', async () => {
    const { result } = await renderHook(() => useExportReminder());
    await act(async () => {
      await result.current.exportNow();
    });
    expect(exportEntriesMock).toHaveBeenCalledWith(
      mockEntries,
      expect.any(String)
    );
    const state = await loadExportReminderState();
    expect(state.lastExportedAt).toBe(today());
  });
});
