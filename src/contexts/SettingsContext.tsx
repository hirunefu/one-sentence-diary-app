import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { loadSettings, saveSettings } from '../repositories/settingsRepository';
import { requestNotificationPermission } from '../services/notifications';

type SettingsContextValue = {
  settings: Settings;
  ready: boolean;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
  // Turns Reminders on when notifications are (or become) allowed, and says
  // whether they are on. No Alert and never throws: the caller (Home's offer)
  // knows what to say. The Settings switch keeps updateSettings and its Alert.
  enableReminders: () => Promise<boolean>;
};

// What the Settings switch says when notifications are not allowed.
export const NOTIFICATIONS_OFF_ALERT = {
  title: '通知が許可されていません',
  message: '設定アプリから通知を許可してください',
} as const;

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  // The latest settings, for a call that awaits a system dialog.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

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
          Alert.alert(NOTIFICATIONS_OFF_ALERT.title, NOTIFICATIONS_OFF_ALERT.message);
          next.reminderEnabled = false;
        }
      }

      settingsRef.current = next;
      setSettings(next);
      await saveSettings(next);
      // 通知の (再)スケジュールは ReminderScheduler コンポーネントが
      // settings + entries の変化を監視して自動で実行する
    },
    [settings]
  );

  const enableReminders = useCallback(async () => {
    if (settingsRef.current.reminderEnabled) return true;
    let granted = false;
    try {
      granted = await requestNotificationPermission();
    } catch (e) {
      console.error('notification permission request failed', e);
    }
    if (!granted) return false;
    const next = { ...settingsRef.current, reminderEnabled: true };
    settingsRef.current = next;
    setSettings(next);
    await saveSettings(next).catch((e) => console.error('settings save failed', e));
    return true;
  }, []);

  const value = useMemo(
    () => ({ settings, ready, updateSettings, enableReminders }),
    [settings, ready, updateSettings, enableReminders]
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
