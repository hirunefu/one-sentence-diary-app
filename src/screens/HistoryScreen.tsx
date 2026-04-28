import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEntries } from '../contexts/EntriesContext';
import { useSettings } from '../contexts/SettingsContext';
import { EntryCard } from '../components/EntryCard';
import { useColors } from '../theme/useColors';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HistoryScreen() {
  const colors = useColors();
  const navigation = useNavigation<Nav>();
  const { entries, getDatesInMonth } = useEntries();
  const { settings, updateSettings } = useSettings();

  const [marked, setMarked] = useState<Record<string, { marked: boolean; dotColor?: string }>>({});
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const loadMonth = useCallback(
    async (y: number, m: number) => {
      const dates = await getDatesInMonth(y, m);
      const map: Record<string, { marked: boolean; dotColor?: string }> = {};
      for (const d of dates) {
        map[d] = { marked: true, dotColor: colors.primary };
      }
      setMarked(map);
    },
    [getDatesInMonth, colors.primary]
  );

  useEffect(() => {
    loadMonth(year, month);
  }, [year, month, loadMonth, entries]);

  const openEditor = (date: string) => {
    navigation.navigate('EntryEditor', { date });
  };

  const calendarTheme = {
    backgroundColor: colors.background,
    calendarBackground: colors.background,
    textSectionTitleColor: colors.textMuted,
    selectedDayBackgroundColor: colors.primary,
    selectedDayTextColor: colors.primaryText,
    todayTextColor: colors.primary,
    dayTextColor: colors.text,
    textDisabledColor: colors.disabled,
    dotColor: colors.primary,
    selectedDotColor: colors.primaryText,
    arrowColor: colors.primary,
    monthTextColor: colors.text,
    indicatorColor: colors.primary,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.toggleRow}>
        <Pressable
          onPress={() => updateSettings({ viewMode: 'calendar' })}
          style={[
            styles.tab,
            { borderBottomColor: settings.viewMode === 'calendar' ? colors.primary : 'transparent' },
          ]}
        >
          <Text style={[styles.tabText, { color: colors.text }]}>カレンダー</Text>
        </Pressable>
        <Pressable
          onPress={() => updateSettings({ viewMode: 'timeline' })}
          style={[
            styles.tab,
            { borderBottomColor: settings.viewMode === 'timeline' ? colors.primary : 'transparent' },
          ]}
        >
          <Text style={[styles.tabText, { color: colors.text }]}>タイムライン</Text>
        </Pressable>
      </View>

      {settings.viewMode === 'calendar' ? (
        <Calendar
          // theme key triggers re-render when colors change
          key={colors.background}
          markedDates={marked}
          theme={calendarTheme}
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
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>まだ記録がありません</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toggleRow: { flexDirection: 'row', padding: 8 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  tabText: { fontSize: 14 },
  empty: { textAlign: 'center', marginTop: 32 },
});
