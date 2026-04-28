import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/useColors';

export function StreakBadge({ days }: { days: number }) {
  const colors = useColors();
  const label = days === 0 ? 'まだ記録がありません' : `🔥 ${days}日連続`;
  return (
    <View style={[styles.container, { backgroundColor: colors.streakBg }]}>
      <Text style={[styles.text, { color: colors.streakText }]}>{label}</Text>
    </View>
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
