import { useCallback } from 'react';
import { Alert } from 'react-native';
import Constants from 'expo-constants';
import { useEntries } from '../contexts/EntriesContext';
import { useSettings } from '../contexts/SettingsContext';
import {
  maybeRemindExport,
  type ExportPromptResult,
} from '../services/exportReminder';
import {
  loadExportReminderState,
  setLastExportedAt,
  setLastRemindedAt,
} from '../repositories/exportReminderRepository';
import { exportEntries } from '../services/exportService';
import { today } from '../utils/date';

export function useExportReminder(): {
  remindAfterSave: (savedDate: string) => Promise<void>;
  exportNow: () => Promise<void>;
} {
  const { entries } = useEntries();
  const { settings } = useSettings();

  const runExport = useCallback(async () => {
    await exportEntries(entries, Constants.expoConfig?.version ?? '1.0.0');
  }, [entries]);

  // 設定画面の手動エクスポート用。リマインドのカウンターもリセットする
  const exportNow = useCallback(async () => {
    await runExport();
    await setLastExportedAt(today());
  }, [runExport]);

  const promptExport = useCallback(
    (message: string) =>
      new Promise<ExportPromptResult>((resolve) => {
        Alert.alert('バックアップの時間です', message, [
          {
            text: 'あとで',
            style: 'cancel',
            onPress: () => resolve('later'),
          },
          {
            text: 'エクスポート',
            onPress: async () => {
              try {
                await runExport();
                resolve('exported');
              } catch (e) {
                console.error('export failed', e);
                Alert.alert('エクスポートに失敗しました');
                // 失敗時も次の間隔までは再提示しない ('later' と同じ扱い)
                resolve('later');
              }
            },
          },
        ]);
      }),
    [runExport]
  );

  const remindAfterSave = useCallback(
    async (savedDate: string) => {
      try {
        await maybeRemindExport(
          {
            loadState: loadExportReminderState,
            markReminded: setLastRemindedAt,
            markExported: setLastExportedAt,
            promptExport,
          },
          {
            savedDate,
            todayStr: today(),
            enabled: settings.exportReminderEnabled,
            intervalDays: settings.exportReminderIntervalDays,
          }
        );
      } catch (e) {
        // リマインドは保存の副次機能。失敗を保存フローに波及させない
        console.error('export reminder failed', e);
      }
    },
    [
      promptExport,
      settings.exportReminderEnabled,
      settings.exportReminderIntervalDays,
    ]
  );

  return { remindAfterSave, exportNow };
}
