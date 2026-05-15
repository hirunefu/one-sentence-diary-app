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
import { Calendar, DateData, LocaleConfig } from 'react-native-calendars';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEntries } from '../contexts/EntriesContext';
import { useSettings } from '../contexts/SettingsContext';
import { TimelineRow } from '../components/TimelineRow';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { space } from '../theme/spacing';
import { radius } from '../theme/radius';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// react-native-calendars の表示を日本語化 (一度だけ)
LocaleConfig.locales['jp'] = {
  monthNames: [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月',
  ],
  monthNamesShort: [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月',
  ],
  dayNames: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
  dayNamesShort: ['日', '月', '火', '水', '木', '金', '土'],
  today: '今日',
};
LocaleConfig.defaultLocale = 'jp';

// 日曜・土曜の色 (light/dark 共通の控えめトーン)
const SUN_COLOR = '#c44d4d';
const SAT_COLOR = '#3b82c4';

type DayCellProps = {
  date?: DateData;
  // react-native-calendars の DayState: '' | 'selected' | 'disabled' | 'today' | 'inactive'
  state?: string;
  marking?: { marked?: boolean; dotColor?: string };
  onPress?: (date: DateData) => void;
};

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
    // 曜日ラベル: 個別色は dayHeader カスタムが効かないため、ここでは平日色のみ指定
    textSectionTitleColor: colors.textMuted,
    // 日曜・土曜の曜日ラベル色 (theme で対応している RN-Calendars の拡張キー)
    textSectionTitleDisabledColor: colors.disabled,
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

  const renderDay = useCallback(
    (dayProps: DayCellProps) => {
      const { date, state, marking, onPress } = dayProps;
      if (!date) return <View style={dayStyles.cell} />;

      const dow = new Date(date.year, date.month - 1, date.day).getDay();
      const isSun = dow === 0;
      const isSat = dow === 6;
      const isToday = state === 'today';
      const isDisabled = state === 'disabled';
      const hasDot = !!marking?.marked;

      let textColor = colors.text;
      if (isDisabled) {
        textColor = colors.disabled;
      } else if (isSun) {
        textColor = SUN_COLOR;
      } else if (isSat) {
        textColor = SAT_COLOR;
      }

      return (
        <Pressable
          testID={`day-${date.dateString}`}
          onPress={() => onPress?.(date)}
          disabled={isDisabled}
          style={[
            dayStyles.cell,
            isToday && { backgroundColor: colors.surface },
          ]}
        >
          <Text
            style={[
              dayStyles.text,
              { color: textColor },
              isToday && { fontWeight: typography.weight.semibold },
            ]}
          >
            {date.day}
          </Text>
          {hasDot && (
            <View
              style={[dayStyles.dot, { backgroundColor: marking?.dotColor ?? colors.text }]}
            />
          )}
        </Pressable>
      );
    },
    [colors]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.toggleWrapper, { borderBottomColor: colors.divider }]}
        onLayout={onTabsLayout}
      >
        <View style={styles.toggleRow}>
          <Pressable
            testID="history-tab-calendar"
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
            testID="history-tab-timeline"
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
          // The theme prop doesn't fully reactively propagate color changes,
          // so change the key on theme switch to force a remount.
          key={colors.background}
          markedDates={marked}
          theme={calendarTheme}
          dayComponent={renderDay}
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

const dayStyles = StyleSheet.create({
  cell: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  text: {
    fontSize: typography.size.cardBody - 2,
    lineHeight: typography.size.cardBody,
  },
  dot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
