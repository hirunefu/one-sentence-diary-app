import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useEntries } from '../contexts/EntriesContext';
import { useSettings } from '../contexts/SettingsContext';
import { cancelAllReminders, rescheduleReminders } from '../services/notifications';

// 通知のスケジュール責務を持つ「見えないコンポーネント」。
// settings (リマインダー時刻 ON/OFF) と entries (記録済み日付) の変化、
// およびアプリのフォアグラウンド復帰を監視して、
// 「未記録の日のみ通知が飛ぶ」状態を維持する。
export function ReminderScheduler(): null {
  const { settings, ready: settingsReady } = useSettings();
  const { entries, ready: entriesReady } = useEntries();
  const [foregroundCount, setForegroundCount] = useState(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        setForegroundCount((c) => c + 1);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!settingsReady || !entriesReady) return;

    if (!settings.reminderEnabled) {
      cancelAllReminders().catch((e) =>
        console.error('failed to cancel reminders', e)
      );
      return;
    }

    const recordedDates = new Set(entries.map((e) => e.date));
    rescheduleReminders({
      hour: settings.reminderHour,
      minute: settings.reminderMinute,
      recordedDates,
    }).catch((e) => console.error('failed to reschedule reminders', e));
  }, [
    settings.reminderEnabled,
    settings.reminderHour,
    settings.reminderMinute,
    entries,
    settingsReady,
    entriesReady,
    foregroundCount,
  ]);

  return null;
}
