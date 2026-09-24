import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, type View } from 'react-native';
import { Phrases } from './Phrases';
import { longestTodayCopy } from '../services/celebrationCopy';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

const FADE_MS = 200;

// Home's quiet line on the day the Streak passes the Longest streak without
// reaching a Milestone. It fades in once (opacity only, so also with reduce
// motion) and then stays still for the rest of the day.
export function LongestTodayLine({
  previousLongest,
  ref,
}: {
  previousLongest: number;
  // For moving screen-reader focus to the line.
  ref?: React.Ref<View>;
}) {
  const colors = useColors();
  const copy = longestTodayCopy(previousLongest);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fade = Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    fade.start(({ finished }) => {
      if (finished) opacity.setValue(1);
    });
    return () => fade.stop();
  }, [opacity]);

  const text = [styles.text, { color: colors.textMuted }];
  return (
    <Animated.View
      ref={ref}
      testID="longest-today"
      accessible
      accessibilityLabel={copy.spoken}
      style={[styles.box, { opacity }]}
    >
      <Phrases text={copy.headline} align="right" style={text} />
      <Phrases text={copy.line} align="right" style={text} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  text: {
    fontSize: typography.size.caption,
    lineHeight: typography.size.caption + 6,
  },
});
