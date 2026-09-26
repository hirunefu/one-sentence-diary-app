import React from 'react';
import { Alert } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockRequest = jest.fn<Promise<boolean>, []>();
jest.mock('../services/notifications', () => ({
  requestNotificationPermission: () => mockRequest(),
}));

import { NOTIFICATIONS_OFF_ALERT, SettingsProvider, useSettings } from './SettingsContext';
import { loadSettings } from '../repositories/settingsRepository';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
);
const open = async () => {
  const hook = await renderHook(() => useSettings(), { wrapper });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
};

describe('SettingsProvider', () => {
  let alert: jest.SpyInstance;
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockRequest.mockReset();
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => alert.mockRestore());

  describe('enableReminders', () => {
    test('turns Reminders on and keeps them when notifications are allowed', async () => {
      mockRequest.mockResolvedValue(true);
      const { result } = await open();
      let on: boolean | undefined;
      await act(async () => {
        on = await result.current.enableReminders();
      });
      expect(on).toBe(true);
      expect(result.current.settings.reminderEnabled).toBe(true);
      expect((await loadSettings()).reminderEnabled).toBe(true);
    });

    // The caller (Home's offer) says what to say.
    test('leaves them off, with no Alert, when refused', async () => {
      mockRequest.mockResolvedValue(false);
      const { result } = await open();
      let on: boolean | undefined;
      await act(async () => {
        on = await result.current.enableReminders();
      });
      expect(on).toBe(false);
      expect(result.current.settings.reminderEnabled).toBe(false);
      expect(alert).not.toHaveBeenCalled();
    });

    test('reports off, with no Alert, when the request fails', async () => {
      mockRequest.mockRejectedValue(new Error('no activity'));
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      const { result } = await open();
      let on: boolean | undefined;
      await act(async () => {
        on = await result.current.enableReminders();
      });
      expect(on).toBe(false);
      expect(alert).not.toHaveBeenCalled();
      error.mockRestore();
    });

    test('keeps a setting changed just before it', async () => {
      mockRequest.mockResolvedValue(true);
      const { result } = await open();
      await act(async () => {
        await result.current.updateSettings({ reminderHour: 7, reminderMinute: 30 });
        await result.current.enableReminders();
      });
      expect(result.current.settings).toMatchObject({
        reminderEnabled: true,
        reminderHour: 7,
        reminderMinute: 30,
      });
    });

    test('does not ask again when Reminders are already on', async () => {
      mockRequest.mockResolvedValue(true);
      const { result } = await open();
      await act(async () => {
        await result.current.enableReminders();
      });
      mockRequest.mockClear();
      let on: boolean | undefined;
      await act(async () => {
        on = await result.current.enableReminders();
      });
      expect(on).toBe(true);
      expect(mockRequest).not.toHaveBeenCalled();
    });
  });

  test('the Settings switch still explains a refusal with its Alert', async () => {
    mockRequest.mockResolvedValue(false);
    const { result } = await open();
    await act(async () => {
      await result.current.updateSettings({ reminderEnabled: true });
    });
    expect(result.current.settings.reminderEnabled).toBe(false);
    expect(alert).toHaveBeenCalledWith(NOTIFICATIONS_OFF_ALERT.title, NOTIFICATIONS_OFF_ALERT.message);
  });
});
