import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Entry } from '../types';

type Props = {
  entry: Entry;
  onPress: (date: string) => void;
};

export function EntryCard({ entry, onPress }: Props) {
  return (
    <Pressable
      onPress={() => onPress(entry.date)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Text style={styles.date}>{entry.date}</Text>
      <Text style={styles.text}>{entry.text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pressed: {
    opacity: 0.7,
  },
  date: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  text: {
    fontSize: 16,
  },
});
