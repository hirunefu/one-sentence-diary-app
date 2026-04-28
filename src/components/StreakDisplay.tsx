import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

export type StreakDay = {
  date: string;
  recorded: boolean;
  isToday: boolean;
};

type Props = {
  days: number;
  last7: StreakDay[];
};

export function StreakDisplay({ days, last7 }: Props) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const prevDaysRef = useRef(days);

  useEffect(() => {
    if (days > prevDaysRef.current) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 140, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 80 }),
      ]).start();
    }
    prevDaysRef.current = days;
  }, [days, scale]);

  return (
    <View style={styles.container}>
      <View style={styles.numRow}>
        <Animated.Text
          style={[
            styles.num,
            { color: colors.text, transform: [{ scale }] },
          ]}
        >
          {days}
        </Animated.Text>
        <Text style={[styles.suffix, { color: colors.textMuted }]}>日連続</Text>
      </View>
      <View style={styles.dots}>
        {last7.map((d, i) => (
          <View
            key={d.date}
            testID={`streak-dot-${i}`}
            style={[
              styles.dot,
              { backgroundColor: d.recorded ? colors.text : colors.border },
              d.isToday && {
                borderWidth: 1.5,
                borderColor: colors.text,
                backgroundColor: d.recorded ? colors.text : colors.border,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: colors.textMuted }]}>直近7日</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    gap: 5,
  },
  numRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  num: {
    fontSize: typography.size.streakNum,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.streakNum,
  },
  suffix: {
    fontSize: 10,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  label: {
    fontSize: typography.size.micro,
  },
});
