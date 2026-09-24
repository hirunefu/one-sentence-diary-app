import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Phrases } from './Phrases';
import { PressableScale } from './PressableScale';
import {
  REPAIR_CLOSE_HINT,
  REPAIR_CLOSE_LABEL,
  REPAIR_WRITE_LABEL,
  repairLine,
} from '../services/streakBreakCopy';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { space } from '../theme/spacing';
import { radius } from '../theme/radius';

type Props = { streakAfter: number; onWrite: () => void; onClose: () => void };

// Home's Streak repair offer when only yesterday is missing: one quiet line
// and two equal buttons. Inline and persistent (no timer, no motion), not a
// snackbar or a dialog; 閉じる declines it for that day.
export function StreakRepairLine({ streakAfter, onWrite, onClose }: Props) {
  const colors = useColors();
  const line = repairLine(streakAfter);
  return (
    <View testID="streak-repair" style={styles.box}>
      <View accessible accessibilityLabel={line}>
        <Phrases
          text={line}
          align="right"
          style={[styles.line, { color: colors.textMuted }]}
        />
      </View>
      <View style={styles.buttons}>
        <OutlinedButton
          testID="streak-repair-close"
          label={REPAIR_CLOSE_LABEL}
          hint={REPAIR_CLOSE_HINT}
          onPress={onClose}
        />
        <OutlinedButton testID="streak-repair-write" label={REPAIR_WRITE_LABEL} onPress={onWrite} />
      </View>
    </View>
  );
}

function OutlinedButton({
  testID,
  label,
  hint,
  onPress,
}: {
  testID: string;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={styles.target}
    >
      <View style={[styles.outline, { borderColor: colors.textMuted }]}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  box: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    gap: space.xs,
  },
  line: {
    fontSize: typography.size.caption,
    lineHeight: typography.size.caption + 6,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: space.sm,
  },
  // 48dp to touch; the outline inside it is smaller.
  target: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
  },
  outline: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  label: {
    fontSize: typography.size.button,
  },
});
