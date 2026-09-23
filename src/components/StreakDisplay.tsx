import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { useReduceMotion } from '../hooks/useReduceMotion';

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
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (days > prevDaysRef.current && !reduceMotion) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 140, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 80 }),
      ]).start();
    }
    prevDaysRef.current = days;
  }, [days, scale, reduceMotion]);

  const recordedCount = last7.filter((d) => d.recorded).length;

  return (
    // Read as one sentence by screen readers instead of a number, a suffix and
    // seven unlabeled dots.
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`${days}日連続。直近7日のうち${recordedCount}日記録あり`}
    >
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
    fontSize: typography.size.caption,
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
