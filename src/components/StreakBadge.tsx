import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useColors } from '../theme/useColors';

export function StreakBadge({ days }: { days: number }) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const prevDaysRef = useRef(days);

  useEffect(() => {
    if (days > prevDaysRef.current) {
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.18,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 4,
          tension: 80,
        }),
      ]).start();
    }
    prevDaysRef.current = days;
  }, [days, scale]);

  const label = days === 0 ? 'まだ記録がありません' : `🔥 ${days}日連続`;
  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.streakBg, transform: [{ scale }] },
      ]}
    >
      <Text style={[styles.text, { color: colors.streakText }]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
});
