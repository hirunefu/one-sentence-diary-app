import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Phrases } from './Phrases';
import { FADE_MS } from './LongestTodayLine';
import { FIRST_DAY_LINE, FIRST_RUN_DOTS, PRIVACY_LINE } from '../services/firstRunCopy';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

// Home's quiet lines for a first-time user (ADR 0002). Shown in place, never
// as a tutorial: nothing to dismiss, no motion at rest, and nothing that looks
// tappable.

// Under the Streak's dots while there is no Entry.
export function FirstRunDotsLine() {
  const colors = useColors();
  return (
    <View testID="first-run-dots" accessible accessibilityLabel={FIRST_RUN_DOTS.spoken} style={styles.right}>
      <Phrases text={FIRST_RUN_DOTS.shown} align="right" style={[styles.text, { color: colors.textMuted }]} />
    </View>
  );
}

// At the bottom of Home while there is no Entry; fades out with the first save.
export function PrivacyLine({ leaving }: { leaving: boolean }) {
  const colors = useColors();
  const opacity = useFade(leaving ? 0 : 1, 1);
  return (
    <Animated.View
      testID="first-run-privacy"
      accessible
      accessibilityLabel={PRIVACY_LINE}
      style={{ opacity }}
    >
      <Phrases text={PRIVACY_LINE} align="left" style={[styles.text, { color: colors.textMuted }]} />
    </Animated.View>
  );
}

// Under the Streak for the rest of the first day. It fades in when it takes
// the dot line's place, and is simply there after a relaunch.
export function FirstDayLine({ enter, ref }: { enter: boolean; ref?: React.Ref<View> }) {
  const colors = useColors();
  const opacity = useFade(1, enter ? 0 : 1);
  return (
    <Animated.View
      ref={ref}
      testID="first-day"
      accessible
      accessibilityLabel={FIRST_DAY_LINE}
      style={[styles.right, { opacity }]}
    >
      <Phrases text={FIRST_DAY_LINE} align="right" style={[styles.text, { color: colors.textMuted }]} />
    </Animated.View>
  );
}

// Opacity that starts at `from` and fades to `to` over FADE_MS (opacity only,
// so also with reduce motion, as LongestTodayLine).
export function useFade(to: number, from: number): Animated.Value {
  const opacity = useRef(new Animated.Value(from)).current;
  useEffect(() => {
    const fade = Animated.timing(opacity, {
      toValue: to,
      duration: FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    fade.start(({ finished }) => {
      if (finished) opacity.setValue(to);
    });
    return () => fade.stop();
  }, [opacity, to]);
  return opacity;
}

const styles = StyleSheet.create({
  right: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  text: {
    fontSize: typography.size.caption,
    lineHeight: typography.size.caption + 6,
  },
});
