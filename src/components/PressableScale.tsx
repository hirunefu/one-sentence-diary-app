import React, { useCallback, useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useReduceMotion } from '../hooks/useReduceMotion';

// Pressable 自身を Animated 要素にし、style と transform を同じ要素に適用する。
// 旧実装のように Animated.View でラップすると、flex 等の layout プロパティが
// 外側ラッパーに伝わらず横並びレイアウトが崩れるため。
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

export function PressableScale({
  pressedScale = 0.96,
  style,
  onPressIn,
  onPressOut,
  accessibilityRole = 'button',
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReduceMotion();

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      if (!reduceMotion) {
        Animated.spring(scale, {
          toValue: pressedScale,
          useNativeDriver: true,
          speed: 50,
          bounciness: 0,
        }).start();
      }
      onPressIn?.(e);
    },
    [pressedScale, onPressIn, scale, reduceMotion]
  );

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      if (reduceMotion) {
        // Reduce motion may have turned on mid-press; don't leave it shrunk.
        scale.setValue(1);
      } else {
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 30,
          bounciness: 8,
        }).start();
      }
      onPressOut?.(e);
    },
    [onPressOut, scale, reduceMotion]
  );

  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      {...rest}
      style={[style, { transform: [{ scale }] }]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    />
  );
}
