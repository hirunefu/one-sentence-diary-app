import React, { useCallback } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { countChars, stripNewlines } from '../utils/text';
import { MAX_TEXT_LENGTH } from '../types';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

const WARNING_THRESHOLD = 20;
const DANGER_THRESHOLD = 10;

export function EntryInput({
  value,
  onChangeText,
  placeholder = '今日の一文を書く',
  autoFocus,
}: Props) {
  const colors = useColors();

  // 「一口日記 = 1 文」のコンセプトを担保するため、改行は入力段で取り除き、
  // 上限超過は文字列を切り詰めずに変更そのものを破棄する (= IME 変換中の
  // 中間状態でも視覚的に文字数が増減しない)。
  // この契約は importService.isValidEntry でも同じ条件で検証している。
  const handleChange = useCallback(
    (next: string) => {
      const cleaned = stripNewlines(next);
      if (countChars(cleaned) > MAX_TEXT_LENGTH) return;
      onChangeText(cleaned);
    },
    [onChangeText]
  );

  const remaining = MAX_TEXT_LENGTH - countChars(value);

  let countColor = colors.textMuted;
  let countWeight: '400' | '600' = '400';
  if (remaining <= DANGER_THRESHOLD) {
    countColor = colors.danger;
    countWeight = '600';
  } else if (remaining <= WARNING_THRESHOLD) {
    countColor = colors.warning;
  }

  return (
    <View style={styles.container}>
      <Text
        testID="remaining-count"
        style={[styles.count, { color: countColor, fontWeight: countWeight }]}
      >
        残り {remaining} 字
      </Text>
      <TextInput
        testID="entry-input"
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textPlaceholder}
        autoFocus={autoFocus}
        multiline
        textAlignVertical="top"
        style={[styles.input, { color: colors.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  input: {
    fontSize: typography.size.body,
    lineHeight: typography.size.body * typography.lineHeight.body,
    padding: 0,
  },
  count: {
    alignSelf: 'flex-end',
    fontSize: typography.size.caption,
    marginBottom: 6,
  },
});
