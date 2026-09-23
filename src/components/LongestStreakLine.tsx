import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { space } from '../theme/spacing';

// History's quiet line for the Longest streak (it includes the current Streak).
// One text, so a screen reader reads it exactly as shown.
export function LongestStreakLine({ days }: { days: number }) {
  const colors = useColors();
  if (days <= 0) return null;
  return (
    <Text testID="history-longest-streak" style={[styles.line, { color: colors.textMuted }]}>
      最長記録 <Text style={[styles.days, { color: colors.text }]}>{days}日</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  line: {
    alignSelf: 'flex-end',
    paddingHorizontal: space.lg + 2,
    paddingTop: space.sm,
    fontSize: typography.size.caption,
  },
  days: {
    fontSize: typography.size.button,
    fontWeight: typography.weight.medium,
  },
});
