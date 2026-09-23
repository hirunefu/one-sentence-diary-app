import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { fromDateString } from '../utils/date';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { space } from '../theme/spacing';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

type Props = {
  // The calendar passes its current month as an XDate.
  month: { getFullYear(): number; getMonth(): number };
  addMonth: (count: number) => void;
  todayStr: string;
};

// Replaces react-native-calendars' header, whose title and arrows are hidden
// from TalkBack, ignore the font-size setting, and let the screen-reader
// "increment" action move past today. Only today or a past day can have an
// Entry, so the calendar never moves beyond the month that contains today.
// The calendar announces month changes itself.
export function CalendarHeader({ month, addMonth, todayStr }: Props) {
  const colors = useColors();
  const year = month.getFullYear();
  const monthNumber = month.getMonth() + 1;
  const todayDate = fromDateString(todayStr);
  const nextDisabled =
    year * 12 + monthNumber >= todayDate.getFullYear() * 12 + todayDate.getMonth() + 1;

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <PressableScale
          onPress={() => addMonth(-1)}
          accessibilityLabel="前の月"
          hitSlop={space.sm}
          style={styles.arrow}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={colors.text}
            importantForAccessibility="no"
          />
        </PressableScale>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {`${year}年${monthNumber}月`}
        </Text>
        <PressableScale
          onPress={() => {
            if (!nextDisabled) addMonth(1);
          }}
          disabled={nextDisabled}
          accessibilityLabel="次の月"
          accessibilityState={{ disabled: nextDisabled }}
          hitSlop={space.sm}
          style={styles.arrow}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={nextDisabled ? colors.disabled : colors.text}
            importantForAccessibility="no"
          />
        </PressableScale>
      </View>
      {/* Each day cell already says its weekday, so this row is visual only. */}
      <View style={styles.weekRow} importantForAccessibility="no-hide-descendants">
        {WEEKDAYS.map((name, i) => (
          <Text
            key={name}
            style={[
              styles.weekday,
              {
                color:
                  i === 0 ? colors.sunday : i === 6 ? colors.saturday : colors.textMuted,
              },
            ]}
          >
            {name}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space.sm,
    paddingTop: space.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrow: {
    padding: space.sm,
  },
  title: {
    fontSize: typography.size.title,
    fontWeight: typography.weight.medium,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: space.md,
    marginBottom: space.xs,
  },
  weekday: {
    width: 32,
    textAlign: 'center',
    fontSize: typography.size.button,
  },
});
