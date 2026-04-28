import React, { useCallback } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { countChars, stripNewlines } from '../utils/text';
import { MAX_TEXT_LENGTH } from '../types';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export function EntryInput({
  value,
  onChangeText,
  placeholder = '今日の一文を書く',
  autoFocus,
}: Props) {
  const handleChange = useCallback(
    (next: string) => {
      const cleaned = stripNewlines(next);
      if (countChars(cleaned) > MAX_TEXT_LENGTH) return;
      onChangeText(cleaned);
    },
    [onChangeText]
  );

  const remaining = MAX_TEXT_LENGTH - countChars(value);

  return (
    <View style={styles.container}>
      <TextInput
        testID="entry-input"
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        multiline={false}
        style={styles.input}
      />
      <Text testID="remaining-count" style={styles.count}>
        {remaining}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 48,
  },
  count: {
    alignSelf: 'flex-end',
    marginTop: 4,
    color: '#888',
    fontSize: 12,
  },
});
