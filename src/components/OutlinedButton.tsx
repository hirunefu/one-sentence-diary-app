import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { space } from '../theme/spacing';
import { radius } from '../theme/radius';

// The quiet button of Home's inline offers: an outline, equal in weight to
// its neighbour, on a 48dp target (the outline inside it is smaller).
export function OutlinedButton({
  testID,
  label,
  hint,
  disabled = false,
  onPress,
}: {
  testID: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.target}
    >
      <View style={[styles.outline, { borderColor: colors.textMuted }]}>
        <Text style={[styles.label, { color: disabled ? colors.textMuted : colors.text }]}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
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
