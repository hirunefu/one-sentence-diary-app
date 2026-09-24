import React, { useCallback, useEffect, useId, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text, TextInput, View } from 'react-native';
import { countChars, stripNewlines } from '../utils/text';
import { MAX_TEXT_LENGTH } from '../types';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

// What the field is called. TalkBack names an EditText by its text, or by its
// placeholder while it is empty, and doesn't speak its contentDescription
// (accessibilityLabel); a visible `label` names it through labelFor instead.
type Naming =
  | { label: string; accessibilityLabel?: never }
  | { label?: never; accessibilityLabel: string };

type Props = Naming & {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
};

const WARNING_THRESHOLD = 20;
const DANGER_THRESHOLD = 10;

export function EntryInput({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  label,
  accessibilityLabel,
}: Props) {
  const colors = useColors();
  // Unique per field: Home stays mounted under the Backfill editor, and
  // Android names a field by the first view it finds with this id.
  const labelId = useId();

  // Enforce the "one-sentence diary" contract at the input layer: strip
  // newlines, and on length overflow drop the change entirely instead of
  // truncating, so the visible char count doesn't flicker mid-IME-composition.
  // importService.isValidEntry validates the same conditions on the import
  // side — keep these two in sync.
  const handleChange = useCallback(
    (next: string) => {
      const cleaned = stripNewlines(next);
      if (countChars(cleaned) > MAX_TEXT_LENGTH) return;
      onChangeText(cleaned);
    },
    [onChangeText]
  );

  const remaining = MAX_TEXT_LENGTH - countChars(value);

  // The counter only changes colour, so announce the thresholds (and the
  // hard stop at 0, where further input is dropped) when crossing them.
  const prevRemainingRef = useRef(remaining);
  useEffect(() => {
    const prev = prevRemainingRef.current;
    prevRemainingRef.current = remaining;
    if ([WARNING_THRESHOLD, DANGER_THRESHOLD, 0].some((t) => prev > t && remaining <= t)) {
      AccessibilityInfo.announceForAccessibility(`残り${remaining}字`);
    }
  }, [remaining]);

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
      <View style={styles.header}>
        {label !== undefined && (
          <Text nativeID={labelId} style={[styles.label, { color: colors.textMuted }]}>
            {label}
          </Text>
        )}
        <Text
          testID="remaining-count"
          style={[styles.count, { color: countColor, fontWeight: countWeight }]}
        >
          残り {remaining} 字
        </Text>
      </View>
      <TextInput
        testID="entry-input"
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textPlaceholder}
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel}
        accessibilityLabelledBy={label !== undefined ? labelId : undefined}
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
  // The label on the left, the counter on the right; they wrap at large font
  // sizes rather than overlap.
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: typography.size.caption,
  },
  count: {
    marginLeft: 'auto',
    fontSize: typography.size.caption,
  },
});
