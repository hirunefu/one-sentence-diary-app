import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Entry } from '../types';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { space } from '../theme/spacing';

type Props = {
  entry: Entry;
  onPress: (date: string) => void;
};

export function TimelineRow({ entry, onPress }: Props) {
  const colors = useColors();
  const [year, month, day] = entry.date.split('-');
  void year;

  return (
    <Pressable
      onPress={() => onPress(entry.date)}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.divider },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.dateBlock}>
        <Text style={[styles.day, { color: colors.text }]}>{Number(day)}</Text>
        <Text style={[styles.mon, { color: colors.textMuted }]}>{Number(month)}月</Text>
      </View>
      <Text style={[styles.text, { color: colors.text }]}>{entry.text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.lg + 2,
    borderBottomWidth: 1,
  },
  pressed: { opacity: 0.6 },
  dateBlock: {
    minWidth: 38,
    alignItems: 'center',
  },
  day: {
    fontSize: typography.size.streakNum,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.streakNum,
  },
  mon: {
    fontSize: typography.size.micro,
    marginTop: 2,
  },
  text: {
    flex: 1,
    fontSize: typography.size.cardBody,
    lineHeight: typography.size.cardBody * typography.lineHeight.cardBody,
  },
});
