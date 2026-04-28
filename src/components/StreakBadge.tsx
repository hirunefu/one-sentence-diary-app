import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function StreakBadge({ days }: { days: number }) {
  const label = days === 0 ? 'まだ記録がありません' : `🔥 ${days}日連続`;
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 14,
    color: '#e65100',
    fontWeight: '600',
  },
});
