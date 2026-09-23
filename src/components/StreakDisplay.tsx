import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/useColors';
import type { Colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useReduceMotion } from '../hooks/useReduceMotion';

export type StreakDay = {
  date: string;
  recorded: boolean;
  isToday: boolean;
};

type Props = {
  days: number;
  last7: StreakDay[];
  // False while the screen is not visible (e.g. another tab). Changes that
  // happen meanwhile are played once it becomes visible again, instead of
  // animating off-screen.
  active?: boolean;
};

// The day's dot fills first ("today is recorded"), then the number rolls
// ("so the Streak grew").
const ROLL_DELAY_MS = 140;
const ROLL_MS = 380;
const NUM_LINE = typography.size.streakNum + 4;

export function StreakDisplay({ days, last7, active = true }: Props) {
  const colors = useColors();
  const reduceMotion = useReduceMotion();
  const recordedCount = last7.filter((d) => d.recorded).length;

  // What is on screen lags behind the props while inactive, so the change
  // can be played when the screen comes back.
  const [shownDays, setShownDays] = useState(days);
  const [shownLast7, setShownLast7] = useState(last7);
  useEffect(() => {
    if (active) {
      setShownDays(days);
      setShownLast7(last7);
    }
  }, [active, days, last7]);

  return (
    // Read as one sentence by screen readers instead of a number, a suffix and
    // seven unlabeled dots.
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`${days}日連続。直近7日のうち${recordedCount}日記録あり`}
    >
      <View style={styles.numRow}>
        <RollingNumber value={shownDays} colors={colors} reduceMotion={reduceMotion} />
        <Text style={[styles.suffix, { color: colors.textMuted }]}>日連続</Text>
      </View>
      <View style={styles.dots}>
        {shownLast7.map((d, i) => (
          <Dot
            key={d.date}
            testID={`streak-dot-${i}`}
            recorded={d.recorded}
            isToday={d.isToday}
            colors={colors}
            reduceMotion={reduceMotion}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: colors.textMuted }]}>直近7日</Text>
    </View>
  );
}

// The old number leaves upwards while the new one rises from below (downwards
// when the Streak shrinks), then the new number settles with a small bounce.
function RollingNumber({
  value,
  colors,
  reduceMotion,
}: {
  value: number;
  colors: Colors;
  reduceMotion: boolean;
}) {
  const [previous, setPrevious] = useState<number | null>(null);
  const [direction, setDirection] = useState(1);
  const progress = useRef(new Animated.Value(1)).current;
  const settle = useRef(new Animated.Value(1)).current;
  const lastValueRef = useRef(value);

  useEffect(() => {
    const prev = lastValueRef.current;
    lastValueRef.current = value;
    if (prev === value) return;
    if (reduceMotion) {
      setPrevious(null);
      progress.setValue(1);
      settle.setValue(1);
      return;
    }
    setPrevious(prev);
    setDirection(value > prev ? 1 : -1);
    progress.setValue(0);
    settle.setValue(1);
    const anim = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: ROLL_MS,
        delay: ROLL_DELAY_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(settle, { toValue: 1.12, duration: 90, useNativeDriver: true }),
      Animated.spring(settle, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => {
      if (finished) setPrevious(null);
    });
    return () => anim.stop();
  }, [value, reduceMotion, progress, settle]);

  const incomingY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [direction * NUM_LINE, 0],
  });
  const outgoingY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -direction * NUM_LINE],
  });

  return (
    <View style={styles.numWindow}>
      {previous !== null && (
        <Animated.Text
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.num,
            styles.outgoing,
            {
              color: colors.text,
              opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [{ translateY: outgoingY }],
            },
          ]}
        >
          {previous}
        </Animated.Text>
      )}
      <Animated.Text
        style={[
          styles.num,
          {
            color: colors.text,
            opacity: previous === null ? 1 : progress,
            transform: [{ translateY: previous === null ? 0 : incomingY }, { scale: settle }],
          },
        ]}
      >
        {value}
      </Animated.Text>
    </View>
  );
}

// A day that becomes recorded fills from the centre with a small overshoot,
// and a thin ring spreads out from it and fades.
function Dot({
  recorded,
  isToday,
  colors,
  reduceMotion,
  testID,
}: {
  recorded: boolean;
  isToday: boolean;
  colors: Colors;
  reduceMotion: boolean;
  testID: string;
}) {
  const fill = useRef(new Animated.Value(recorded ? 1 : 0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const wasRecordedRef = useRef(recorded);

  useEffect(() => {
    if (wasRecordedRef.current === recorded) return;
    wasRecordedRef.current = recorded;
    if (reduceMotion || !recorded) {
      fill.setValue(recorded ? 1 : 0);
      ring.setValue(0);
      return;
    }
    fill.setValue(0);
    ring.setValue(0);
    const anim = Animated.parallel([
      Animated.spring(fill, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
      Animated.timing(ring, {
        toValue: 1,
        duration: 560,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [recorded, reduceMotion, fill, ring]);

  return (
    <View testID={testID} style={styles.dotSlot}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.dot,
          styles.ring,
          {
            borderColor: colors.text,
            opacity: ring.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 0.6, 0] }),
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
          },
        ]}
      />
      <View
        style={[
          styles.dot,
          { backgroundColor: colors.border },
          isToday && styles.todayOutline,
          isToday && { borderColor: colors.text },
        ]}
      >
        <Animated.View
          style={[
            styles.dotFill,
            { backgroundColor: colors.text, transform: [{ scale: fill }] },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    gap: 5,
  },
  numRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  numWindow: {
    height: NUM_LINE,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  num: {
    fontSize: typography.size.streakNum,
    fontWeight: typography.weight.semibold,
    lineHeight: NUM_LINE,
    textAlign: 'right',
  },
  outgoing: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  suffix: {
    fontSize: 10, // minimal-redesign spec §3.1
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dotSlot: {
    width: 9,
    height: 9,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 2,
    overflow: 'hidden',
  },
  todayOutline: {
    borderWidth: 1.5,
  },
  dotFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    overflow: 'visible',
  },
  label: {
    fontSize: typography.size.micro,
  },
});
