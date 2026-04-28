import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Alert } from 'react-native';
import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { loadSettings, saveSettings } from '../repositories/settingsRepository';
import {
  rescheduleDailyReminder,
  cancelAllReminders,
  requestNotificationPermission,
} from '../services/notifications';

type SettingsContextValue = {
  settings: Settings;
  ready: boolean;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const loaded = await loadSettings();
        setSettings(loaded);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const updateSettings = useCallback(
    async (partial: Partial<Settings>) => {
      const next = { ...settings, ...partial };

      if (
        partial.reminderEnabled === true &&
        settings.reminderEnabled === false
      ) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          Alert.alert(
            '通知が許可されていません',
            '設定アプリから通知を許可してください'
          );
          next.reminderEnabled = false;
        }
      }

      setSettings(next);
      await saveSettings(next);

      try {
        if (next.reminderEnabled) {
          await rescheduleDailyReminder(next.reminderHour, next.reminderMinute);
        } else {
          await cancelAllReminders();
        }
      } catch (e) {
        console.error('Failed to reschedule reminder', e);
      }
    },
    [settings]
  );

  const value = useMemo(
    () => ({ settings, ready, updateSettings }),
    [settings, ready, updateSettings]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const v = useContext(SettingsContext);
  if (!v) throw new Error('useSettings must be used within SettingsProvider');
  return v;
}
