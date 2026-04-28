import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEntries } from '../contexts/EntriesContext';
import { useSettings } from '../contexts/SettingsContext';
import { EntryCard } from '../components/EntryCard';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HistoryScreen() {
  const navigation = useNavigation<Nav>();
  const { entries, getDatesInMonth } = useEntries();
  const { settings, updateSettings } = useSettings();

  const [marked, setMarked] = useState<Record<string, { marked: boolean }>>({});
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const loadMonth = useCallback(
    async (y: number, m: number) => {
      const dates = await getDatesInMonth(y, m);
      const map: Record<string, { marked: boolean }> = {};
      for (const d of dates) {
        map[d] = { marked: true };
      }
      setMarked(map);
    },
    [getDatesInMonth]
  );

  useEffect(() => {
    loadMonth(year, month);
  }, [year, month, loadMonth, entries]);

  const openEditor = (date: string) => {
    navigation.navigate('EntryEditor', { date });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toggleRow}>
        <Pressable
          onPress={() => updateSettings({ viewMode: 'calendar' })}
          style={[styles.tab, settings.viewMode === 'calendar' && styles.tabActive]}
        >
          <Text style={styles.tabText}>カレンダー</Text>
        </Pressable>
        <Pressable
          onPress={() => updateSettings({ viewMode: 'timeline' })}
          style={[styles.tab, settings.viewMode === 'timeline' && styles.tabActive]}
        >
          <Text style={styles.tabText}>タイムライン</Text>
        </Pressable>
      </View>

      {settings.viewMode === 'calendar' ? (
        <Calendar
          markedDates={marked}
          onDayPress={(day: DateData) => openEditor(day.dateString)}
          onMonthChange={(d: DateData) => {
            setYear(d.year);
            setMonth(d.month);
          }}
        />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.date}
          renderItem={({ item }) => <EntryCard entry={item} onPress={openEditor} />}
          ListEmptyComponent={<Text style={styles.empty}>まだ記録がありません</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  toggleRow: { flexDirection: 'row', padding: 8 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#1976d2' },
  tabText: { fontSize: 14 },
  empty: { textAlign: 'center', marginTop: 32, color: '#888' },
});
