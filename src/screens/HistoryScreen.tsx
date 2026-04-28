import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Animated,
  FlatList,
  LayoutChangeEvent,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEntries } from '../contexts/EntriesContext';
import { useSettings } from '../contexts/SettingsContext';
import { TimelineRow } from '../components/TimelineRow';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { space } from '../theme/spacing';
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

  const indicatorAnim = useRef(
    new Animated.Value(settings.viewMode === 'calendar' ? 0 : 1)
  ).current;
  const [tabsWidth, setTabsWidth] = useState(0);

  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: settings.viewMode === 'calendar' ? 0 : 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [settings.viewMode, indicatorAnim]);

  const loadMonth = useCallback(
    async (y: number, m: number) => {
      const dates = await getDatesInMonth(y, m);
      const map: Record<string, { marked: boolean; dotColor?: string }> = {};
      for (const d of dates) {
        map[d] = { marked: true, dotColor: colors.text };
      }
      setMarked(map);
    },
    [getDatesInMonth, colors.text]
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
    selectedDayBackgroundColor: colors.text,
    selectedDayTextColor: colors.background,
    todayTextColor: colors.text,
    todayBackgroundColor: colors.surface,
    dayTextColor: colors.text,
    textDisabledColor: colors.disabled,
    dotColor: colors.text,
    selectedDotColor: colors.background,
    arrowColor: colors.text,
    monthTextColor: colors.text,
    indicatorColor: colors.text,
  };

  const tabWidth = tabsWidth / 2;
  // indicator width = tabWidth * 0.75 → 各タブの中央に置くため左右に tabWidth * 0.125 のインセット
  const indicatorTranslate = indicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [tabWidth * 0.125, tabWidth * 1.125],
  });

  const onTabsLayout = (e: LayoutChangeEvent) => {
    setTabsWidth(e.nativeEvent.layout.width);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.toggleWrapper, { borderBottomColor: colors.divider }]}
        onLayout={onTabsLayout}
      >
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => updateSettings({ viewMode: 'calendar' })}
            style={styles.tab}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: settings.viewMode === 'calendar' ? colors.text : colors.textMuted,
                  fontWeight:
                    settings.viewMode === 'calendar'
                      ? typography.weight.medium
                      : typography.weight.regular,
                },
              ]}
            >
              カレンダー
            </Text>
          </Pressable>
          <Pressable
            onPress={() => updateSettings({ viewMode: 'timeline' })}
            style={styles.tab}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: settings.viewMode === 'timeline' ? colors.text : colors.textMuted,
                  fontWeight:
                    settings.viewMode === 'timeline'
                      ? typography.weight.medium
                      : typography.weight.regular,
                },
              ]}
            >
              タイムライン
            </Text>
          </Pressable>
        </View>
        {tabsWidth > 0 && (
          <Animated.View
            style={[
              styles.indicator,
              {
                width: tabWidth * 0.75,
                backgroundColor: colors.text,
                transform: [{ translateX: indicatorTranslate }],
              },
            ]}
          />
        )}
      </View>

      {settings.viewMode === 'calendar' ? (
        <Calendar
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
          inverted
          data={entries}
          keyExtractor={(item) => item.date}
          renderItem={({ item }) => <TimelineRow entry={item} onPress={openEditor} />}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              まだ記録がありません
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toggleWrapper: {
    paddingTop: space.sm,
    position: 'relative',
    borderBottomWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    // 横 padding は付けない (indicator の translateX が toggleWrapper 全幅を前提にしている)
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabText: {
    fontSize: typography.size.button,
  },
  indicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    height: 2,
  },
  empty: {
    textAlign: 'center',
    marginTop: space.xxl,
    fontSize: typography.size.button,
  },
});
