import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Phrases } from './Phrases';
import { OutlinedButton } from './OutlinedButton';
import {
  REPAIR_CLOSE_HINT,
  REPAIR_CLOSE_LABEL,
  REPAIR_WRITE_LABEL,
  repairLine,
} from '../services/streakBreakCopy';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { space } from '../theme/spacing';

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
});
