import React, { useState } from 'react';
import { Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import { useSettings } from '../contexts/SettingsContext';
import { useEntries } from '../contexts/EntriesContext';
import { isLocalAuthAvailable } from '../services/localAuth';
import { exportEntries } from '../services/exportService';

export function SettingsScreen() {
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.row}>
          <Text style={styles.label}>生体認証ロック</Text>
          <Switch value={settings.lockEnabled} onValueChange={toggleLock} />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>リマインダー通知</Text>
          <Switch
            value={settings.reminderEnabled}
            onValueChange={(v) => updateSettings({ reminderEnabled: v })}
          />
        </View>

        {settings.reminderEnabled && (
          <Pressable onPress={() => setShowPicker(true)} style={styles.row}>
            <Text style={styles.label}>通知時刻</Text>
            <Text style={styles.value}>{reminderTimeLabel}</Text>
          </Pressable>
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

        <Pressable onPress={handleExport} style={styles.exportButton}>
          <Text style={styles.exportText}>データをエクスポート</Text>
        </Pressable>

        <Text style={styles.version}>
          バージョン: {Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: { fontSize: 16 },
  value: { fontSize: 16, color: '#666' },
  exportButton: {
    marginTop: 32,
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  exportText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  version: { textAlign: 'center', marginTop: 32, color: '#888', fontSize: 12 },
});
