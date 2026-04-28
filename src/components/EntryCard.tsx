import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Entry } from '../types';
import { useColors } from '../theme/useColors';

type Props = {
  entry: Entry;
  onPress: (date: string) => void;
};

export function EntryCard({ entry, onPress }: Props) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => onPress(entry.date)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.date, { color: colors.textMuted }]}>{entry.date}</Text>
      <Text style={[styles.text, { color: colors.text }]}>{entry.text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  date: {
    fontSize: 12,
    marginBottom: 4,
  },
  text: {
    fontSize: 16,
  },
});
