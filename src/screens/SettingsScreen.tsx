import React, { useState } from 'react';
import { Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useSettings } from '../contexts/SettingsContext';
import { useEntries } from '../contexts/EntriesContext';
import { isLocalAuthAvailable } from '../services/localAuth';
import { exportEntries } from '../services/exportService';
import { useColors } from '../theme/useColors';
import { PressableScale } from '../components/PressableScale';
import type { ThemePreference } from '../types';

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
  const { settings, updateSettings } = useSettings();
  const { entries } = useEntries();
  const [showPicker, setShowPicker] = useState(false);

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
          <Switch value={settings.lockEnabled} onValueChange={toggleLock} />
        </View>

        <View style={rowStyle}>
          <Text style={[styles.label, { color: colors.text }]}>リマインダー通知</Text>
          <Switch
            value={settings.reminderEnabled}
            onValueChange={(v) => updateSettings({ reminderEnabled: v })}
          />
        </View>

        {settings.reminderEnabled && (
          <PressableScale onPress={() => setShowPicker(true)} style={rowStyle}>
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
          onPress={handleExport}
          style={[styles.exportButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.exportText, { color: colors.primaryText }]}>データをエクスポート</Text>
        </PressableScale>

        <Text style={[styles.version, { color: colors.textMuted }]}>
          バージョン: {Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>
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
