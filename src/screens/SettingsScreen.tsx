import React, { useState } from 'react';
import { Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { IS_E2E } from '../config/e2eMode';
import seedSevenDays from '../../.maestro/fixtures/seed-7days.json';
import { useSettings } from '../contexts/SettingsContext';
import { useEntries } from '../contexts/EntriesContext';
import { isLocalAuthAvailable } from '../services/localAuth';
import { exportEntries } from '../services/exportService';
import {
  parseImportJson,
  classifyEntries,
  ImportParseError,
  type ClassifiedEntries,
} from '../services/importService';
import type { ImportStrategy } from '../repositories/entriesRepository';
import { ImportConflictModal } from '../components/ImportConflictModal';
import { useColors } from '../theme/useColors';
import { PressableScale } from '../components/PressableScale';
import type { ThemePreference } from '../types';
import type { RootStackParamList } from '../navigation/RootNavigator';

type SettingsNav = NativeStackNavigationProp<RootStackParamList>;

const THEME_OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}> = [
  { value: 'system', label: 'システム', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'ライト', icon: 'sunny-outline' },
  { value: 'dark', label: 'ダーク', icon: 'moon-outline' },
];

export function SettingsScreen() {
  const colors = useColors();
  const navigation = useNavigation<SettingsNav>();
  const { settings, updateSettings } = useSettings();
  const { entries, bulkImport } = useEntries();
  const [showPicker, setShowPicker] = useState(false);
  const [pendingImport, setPendingImport] = useState<ClassifiedEntries | null>(null);

  const toggleLock = async (value: boolean) => {
    if (value) {
      const ok = await isLocalAuthAvailable();
      if (!ok) {
        Alert.alert('この端末では生体認証が利用できません');
        return;
      }
    }
    await updateSettings({ lockEnabled: value });
  };

  const handleExport = async () => {
    if (entries.length === 0) {
      Alert.alert('エクスポートする日記がありません');
      return;
    }
    try {
      await exportEntries(entries, Constants.expoConfig?.version ?? '1.0.0');
    } catch (e) {
      console.error(e);
      Alert.alert('エクスポートに失敗しました');
    }
  };

  const reportImportResult = (result: {
    inserted: number;
    updated: number;
    skipped: number;
    invalid: number;
  }) => {
    const { inserted, updated, skipped, invalid } = result;
    const total = inserted + updated;
    const detail = `内訳: 新規 ${inserted} / 上書き ${updated} / スキップ ${skipped} / 不正 ${invalid}`;
    if (total === 0 && invalid === 0 && skipped === 0) {
      Alert.alert('インポートする日記がありませんでした');
    } else {
      Alert.alert('インポートが完了しました', `${total} 件取り込みました\n${detail}`);
    }
  };

  const runImport = async (
    classified: ClassifiedEntries,
    strategy: ImportStrategy
  ) => {
    try {
      const result = await bulkImport(classified, strategy);
      reportImportResult(result);
    } catch (e) {
      console.error('import failed', e);
      Alert.alert('インポートに失敗しました');
    }
  };

  const pickImportRaw = async (): Promise<string | null> => {
    // E2E: return the bundled fixture as a JSON string, bypassing the
    // DocumentPicker (Maestro can't drive system file pickers).
    if (IS_E2E) return JSON.stringify(seedSevenDays);

    let pickResult: DocumentPicker.DocumentPickerResult;
    try {
      pickResult = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      });
    } catch (e) {
      console.error('document picker failed', e);
      Alert.alert('ファイルを開けませんでした');
      return null;
    }
    if (pickResult.canceled) return null;
    const asset = pickResult.assets[0];
    if (!asset) return null;

    try {
      const file = new File(asset.uri);
      return await file.text();
    } catch (e) {
      console.error('file read failed', e);
      Alert.alert('ファイルを読み込めませんでした');
      return null;
    }
  };

  const handleImport = async () => {
    const raw = await pickImportRaw();
    if (raw === null) return;

    let parsed;
    try {
      parsed = parseImportJson(raw);
    } catch (e) {
      if (e instanceof ImportParseError) {
        Alert.alert('インポートできません', e.message);
      } else {
        Alert.alert('ファイルを読み込めませんでした');
      }
      return;
    }

    const existingDates = new Set(entries.map((e) => e.date));
    const classified = classifyEntries(parsed.entries, existingDates);

    if (classified.conflicts.length === 0) {
      await runImport(classified, 'skip');
      return;
    }

    setPendingImport(classified);
  };

  const handleConfirmImport = async (strategy: ImportStrategy) => {
    const classified = pendingImport;
    setPendingImport(null);
    if (!classified) return;
    await runImport(classified, strategy);
  };

  const handleCancelImport = () => setPendingImport(null);

  const onTimeChange = (_event: unknown, date?: Date) => {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (date) {
      updateSettings({
        reminderHour: date.getHours(),
        reminderMinute: date.getMinutes(),
      });
    }
  };

  const reminderTimeLabel = `${String(settings.reminderHour).padStart(2, '0')}:${String(
    settings.reminderMinute
  ).padStart(2, '0')}`;

  const pickerDate = new Date();
  pickerDate.setHours(settings.reminderHour, settings.reminderMinute, 0, 0);

  const rowStyle = [styles.row, { borderBottomColor: colors.divider }];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>カラーテーマ</Text>
        {THEME_OPTIONS.map((option) => {
          const isSelected = settings.themePreference === option.value;
          return (
            <PressableScale
              testID={`settings-theme-${option.value}`}
              key={option.value}
              onPress={() => updateSettings({ themePreference: option.value })}
              style={rowStyle}
            >
              <View style={styles.rowLeft}>
                <Ionicons
                  name={option.icon}
                  size={22}
                  color={colors.text}
                  style={styles.themeIcon}
                />
                <Text style={[styles.label, { color: colors.text }]}>{option.label}</Text>
              </View>
              {isSelected && (
                <Ionicons name="checkmark" size={22} color={colors.primary} />
              )}
            </PressableScale>
          );
        })}

        <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 24 }]}>
          セキュリティと通知
        </Text>
        <View style={rowStyle}>
          <Text style={[styles.label, { color: colors.text }]}>生体認証ロック</Text>
          <Switch testID="settings-switch-lock" value={settings.lockEnabled} onValueChange={toggleLock} />
        </View>

        <View style={rowStyle}>
          <Text style={[styles.label, { color: colors.text }]}>リマインダー通知</Text>
          <Switch
            testID="settings-switch-reminder"
            value={settings.reminderEnabled}
            onValueChange={(v) => updateSettings({ reminderEnabled: v })}
          />
        </View>

        {settings.reminderEnabled && (
          <PressableScale testID="settings-reminder-time" onPress={() => setShowPicker(true)} style={rowStyle}>
            <Text style={[styles.label, { color: colors.text }]}>通知時刻</Text>
            <Text style={[styles.value, { color: colors.textMuted }]}>{reminderTimeLabel}</Text>
          </PressableScale>
        )}

        {showPicker && (
          <DateTimePicker
            value={pickerDate}
            mode="time"
            is24Hour
            onChange={onTimeChange}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          />
        )}

        <PressableScale
          testID="settings-export"
          onPress={handleExport}
          style={[styles.exportButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.exportText, { color: colors.primaryText }]}>データをエクスポート</Text>
        </PressableScale>

        <PressableScale
          testID="settings-import"
          onPress={handleImport}
          style={[
            styles.exportButton,
            {
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderColor: colors.border,
              marginTop: 12,
            },
          ]}
        >
          <Text style={[styles.exportText, { color: colors.text }]}>データをインポート</Text>
        </PressableScale>

        <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 24 }]}>
          このアプリについて
        </Text>
        <PressableScale
          onPress={() => navigation.navigate('Licenses')}
          style={rowStyle}
        >
          <Text style={[styles.label, { color: colors.text }]}>
            オープンソースライセンス
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </PressableScale>

        <Text style={[styles.version, { color: colors.textMuted }]}>
          バージョン: {Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>
      {pendingImport && (
        <ImportConflictModal
          visible={true}
          totalCount={
            pendingImport.newEntries.length +
            pendingImport.conflicts.length +
            pendingImport.invalid
          }
          newCount={pendingImport.newEntries.length}
          conflictCount={pendingImport.conflicts.length}
          invalidCount={pendingImport.invalid}
          onCancel={handleCancelImport}
          onConfirm={handleConfirmImport}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeIcon: {
    marginRight: 12,
  },
  label: { fontSize: 16 },
  value: { fontSize: 16 },
  exportButton: {
    marginTop: 32,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  exportText: { fontSize: 16, fontWeight: '600' },
  version: { textAlign: 'center', marginTop: 32, fontSize: 12 },
});
