import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { countChars, stripNewlines } from '../utils/text';
import { MAX_TEXT_LENGTH } from '../types';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { Phrases } from './Phrases';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  // What the field is, shown above it. TalkBack reads an EditText's
  // contentDescription (accessibilityLabel) instead of what is written in it,
  // or of its placeholder; named by a label on screen (labelFor), it reads
  // the text, or the placeholder while empty, and then the label.
  label: string;
  placeholder: string;
  autoFocus?: boolean;
  // Take all the height the parent gives, so any tap on the empty area
  // starts writing.
  fill?: boolean;
  // The height the field needs to show its label and the whole Prompt while
  // empty, or one line once written (Home's optional lines give way to it).
  onNeedHeight?: (height: number) => void;
};

// styles.header's marginBottom, which onLayout does not include.
const HEADER_GAP = 6;

const WARNING_THRESHOLD = 20;
const DANGER_THRESHOLD = 10;

export function EntryInput({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  fill,
  label,
  onNeedHeight,
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

  const [heights, setHeights] = useState<{ row?: number; prompt?: number; line?: number }>({});
  const measure = (key: 'row' | 'prompt' | 'line') => (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setHeights((prev) => (prev[key] === h ? prev : { ...prev, [key]: h }));
  };
  const { row, prompt, line } = heights;
  const content = value === '' ? prompt : line;
  const need = row !== undefined && content !== undefined ? row + HEADER_GAP + content : null;
  useEffect(() => {
    if (need !== null) onNeedHeight?.(need);
  }, [need, onNeedHeight]);

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
    <View style={[styles.container, fill && styles.fill]}>
      <View testID="entry-label-row" style={styles.header} onLayout={onNeedHeight && measure('row')}>
        <Text nativeID={labelId} style={[styles.label, { color: colors.textMuted }]}>
          {label}
        </Text>
        <Text
          testID="remaining-count"
          style={[styles.count, { color: countColor, fontWeight: countWeight }]}
        >
          残り {remaining} 字
        </Text>
      </View>
      <View style={fill && styles.fill}>
        {/* The native placeholder stays for screen readers, but Android draws it
            at the font's own line spacing and clips it to the height measured
            at the Entry's. So the placeholder is drawn as text instead: at the
            Entry's line height, breaking after 「、」. */}
        <TextInput
          testID="entry-input"
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor="transparent"
          autoFocus={autoFocus}
          accessibilityLabelledBy={labelId}
          multiline
          textAlignVertical="top"
          style={[styles.input, fill && styles.fill, { color: colors.text }]}
        />
        {value === '' && (
          <View
            testID="entry-prompt"
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            style={styles.placeholder}
            onLayout={onNeedHeight && measure('prompt')}
          >
            <Phrases
              text={placeholder}
              align="left"
              style={[styles.placeholderText, { color: colors.textPlaceholder }]}
            />
          </View>
        )}
        {onNeedHeight && (
          // One line of text, measured for what a written field needs.
          <Text
            testID="entry-line-sizer"
            importantForAccessibility="no-hide-descendants"
            style={[styles.placeholderText, styles.sizer]}
            onLayout={measure('line')}
          >
            一
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  fill: {
    flex: 1,
  },
  input: {
    fontSize: typography.size.body,
    lineHeight: typography.size.body * typography.lineHeight.body,
    padding: 0,
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  sizer: {
    position: 'absolute',
    opacity: 0,
  },
  placeholderText: {
    fontSize: typography.size.body,
    lineHeight: typography.size.body * typography.lineHeight.body,
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
