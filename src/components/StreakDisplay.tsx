import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
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
const ROLL_MS = 280;
const SETTLE_GROW_MS = 90;
// About how long the settle spring (stiffness 800, damping 34) takes to rest.
const SETTLE_SPRING_MS = 300;
const FILL_MS = 280;
const RING_MS = 400;

// From a change of the Streak to the number at rest. What follows the in-place
// celebration (the full-screen one) waits for it.
export const STREAK_IN_PLACE_MS = ROLL_DELAY_MS + ROLL_MS + SETTLE_GROW_MS + SETTLE_SPRING_MS;

// Memoized so that typing on Home does not re-render the dots.
export const StreakDisplay = memo(function StreakDisplay({ days, last7, active = true }: Props) {
  const colors = useColors();
  const reduceMotion = useReduceMotion();
  const recordedCount = last7.filter((d) => d.recorded).length;

  // What is on screen lags behind the props while inactive, so the change
  // can be played when the screen comes back. Derived during render rather
  // than in an effect, so no frame ever shows a half-updated state.
  const [shown, setShown] = useState({ days, last7 });
  if (active && (shown.days !== days || shown.last7 !== last7)) {
    setShown({ days, last7 });
  }

  return (
    // Read as one sentence by screen readers instead of a number, a suffix and
    // seven unlabeled dots.
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`${days}日連続。直近7日のうち${recordedCount}日記録あり`}
    >
      <View style={styles.numRow}>
        <RollingNumber value={shown.days} colors={colors} reduceMotion={reduceMotion} />
        <Text style={[styles.suffix, { color: colors.textMuted }]}>日連続</Text>
      </View>
      <View style={styles.dots}>
        {shown.last7.map((d, i) => (
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
});

type Roll = {
  value: number;
  // The number rolling out, or null when at rest.
  previous: number | null;
  // 0 = the old number in place, 1 = the new one in place. A fresh value per
  // roll, so the first frame of a roll is already its starting frame.
  progress: Animated.Value;
};

// When the Streak grows, the old number leaves upwards while the new one
// rises from below, then the new number settles with a small bounce. A
// shrinking Streak just changes: a loss is not a moment to dwell on.
function RollingNumber({
  value,
  colors,
  reduceMotion,
}: {
  value: number;
  colors: Colors;
  reduceMotion: boolean;
}) {
  const [roll, setRoll] = useState<Roll>(() => ({
    value,
    previous: null,
    progress: new Animated.Value(1),
  }));
  if (roll.value !== value) {
    const grew = value > roll.value && !reduceMotion;
    setRoll({
      value,
      previous: grew ? roll.value : null,
      progress: new Animated.Value(grew ? 0 : 1),
    });
  }
  const settle = useRef(new Animated.Value(1)).current;
  // The roll travels one line, which grows with the OS font size.
  const [distance, setDistance] = useState<number>(typography.size.streakNum);

  useEffect(() => {
    // Also the way out of a roll that was stopped half-way (a newer value,
    // or reduce motion switched on meanwhile).
    settle.setValue(1);
    if (roll.previous === null) return;
    const land = () => {
      // Pinned explicitly: a re-render must not depend on the native driver
      // having synced its end values back to JS.
      roll.progress.setValue(1);
      settle.setValue(1);
      setRoll((r) => (r === roll ? { ...r, previous: null } : r));
    };
    if (reduceMotion) {
      land();
      return;
    }
    const anim = Animated.sequence([
      Animated.timing(roll.progress, {
        toValue: 1,
        duration: ROLL_MS,
        delay: ROLL_DELAY_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(settle, { toValue: 1.1, duration: SETTLE_GROW_MS, useNativeDriver: true }),
      Animated.spring(settle, { toValue: 1, stiffness: 800, damping: 34, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => {
      if (finished) land();
    });
    return () => anim.stop();
  }, [roll, reduceMotion, settle]);

  const motion = useMemo(
    () => ({
      incomingY: roll.progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }),
      outgoingY: roll.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] }),
      outgoingOpacity: roll.progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    }),
    [roll.progress, distance]
  );

  return (
    <View style={styles.numWindow} onLayout={(e) => setDistance(e.nativeEvent.layout.height)}>
      {roll.previous !== null && (
        <Animated.Text
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.num,
            styles.outgoing,
            {
              color: colors.text,
              opacity: motion.outgoingOpacity,
              transform: [{ translateY: motion.outgoingY }],
            },
          ]}
        >
          {roll.previous}
        </Animated.Text>
      )}
      <Animated.Text
        style={[
          styles.num,
          {
            color: colors.text,
            opacity: roll.progress,
            transform: [{ translateY: motion.incomingY }, { scale: settle }],
          },
        ]}
      >
        {roll.value}
      </Animated.Text>
    </View>
  );
}

// A day that becomes recorded fills from the centre while the dot swells a
// little and settles back, and a thin ring spreads out from it and fades.
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
    const becameRecorded = recorded && !wasRecordedRef.current;
    wasRecordedRef.current = recorded;
    if (!becameRecorded || reduceMotion) {
      // Also lands a pop that was stopped half-way by reduce motion.
      fill.setValue(recorded ? 1 : 0);
      ring.setValue(0);
      return;
    }
    fill.setValue(0);
    ring.setValue(0);
    const anim = Animated.parallel([
      Animated.timing(fill, {
        toValue: 1,
        duration: FILL_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ring, {
        toValue: 1,
        duration: RING_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    anim.start(({ finished }) => {
      if (finished) {
        fill.setValue(1);
        ring.setValue(0);
      }
    });
    return () => anim.stop();
  }, [recorded, reduceMotion, fill, ring]);

  const motion = useMemo(
    () => ({
      // The fill is clipped by the dot, so the swell is on the dot itself.
      swell: fill.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.3, 1] }),
      ringOpacity: ring.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 0.6, 0] }),
      // Stays within the dot's own cell, clear of its neighbours and the text.
      ringScale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }),
    }),
    [fill, ring]
  );

  return (
    <View testID={testID} style={styles.dotSlot}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.dot,
          styles.ring,
          {
            borderColor: colors.text,
            opacity: motion.ringOpacity,
            transform: [{ scale: motion.ringScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: colors.border, transform: [{ scale: motion.swell }] },
        ]}
      >
        <Animated.View
          style={[
            styles.dotLayer,
            { backgroundColor: colors.text, transform: [{ scale: fill }] },
          ]}
        />
        {/* Today's outline is drawn over the fill rather than as the dot's
            own border, so no seam of the grey ground shows between the two. */}
        {isToday && (
          <View style={[styles.dotLayer, styles.todayOutline, { borderColor: colors.text }]} />
        )}
      </Animated.View>
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
  // Clips the rolling numbers to one line. Its height comes from the number
  // itself, so it follows the OS font size.
  numWindow: {
    overflow: 'hidden',
  },
  num: {
    fontSize: typography.size.streakNum,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.streakNum,
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
    borderRadius: 2,
  },
  dotLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
  },
  label: {
    fontSize: typography.size.micro,
  },
});
