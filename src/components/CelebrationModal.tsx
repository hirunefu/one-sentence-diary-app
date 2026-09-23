import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from './PressableScale';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { celebrationCopy } from '../services/celebrationCopy';
import type { Celebration } from '../services/celebration';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { space } from '../theme/spacing';
import { radius } from '../theme/radius';

// The page fades in, the Streak rises into place and settles, then the words
// and the button follow. After that nothing moves.
const PAGE_MS = 200;
const RISE_DELAY_MS = 120;
const RISE_MS = 560;
const WORDS_DELAY_MS = RISE_DELAY_MS + RISE_MS;
const WORDS_MS = 240;
const SETTLE_GROW_MS = 90;
const BUTTON_DELAY_MS = 920;
const BUTTON_MS = 200;
export const ENTRANCE_MS = BUTTON_DELAY_MS + BUTTON_MS;
export const EXIT_MS = 180;

type Props = {
  celebration: Celebration | null;
  // The entrance came to rest (the celebration has been seen).
  onSettled: () => void;
  // Closed with 閉じる or Back, after the exit.
  onClose: () => void;
};

// Full-screen and monochrome, in its own window over the tabs. It closes only
// with 閉じる or Back, never by itself or by a stray tap.
export function CelebrationModal({ celebration, onSettled, onClose }: Props) {
  if (!celebration) return null;
  return <CelebrationScreen celebration={celebration} onSettled={onSettled} onClose={onClose} />;
}

function CelebrationScreen({
  celebration,
  onSettled,
  onClose,
}: Props & { celebration: Celebration }) {
  const colors = useColors();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const copy = useMemo(() => celebrationCopy(celebration), [celebration]);

  const initial = reduceMotion ? 1 : 0;
  const page = useRef(new Animated.Value(initial)).current;
  const rise = useRef(new Animated.Value(initial)).current;
  const words = useRef(new Animated.Value(initial)).current;
  const button = useRef(new Animated.Value(initial)).current;
  const settle = useRef(new Animated.Value(1)).current;
  // The Streak rises by half its own line, which grows with the OS font size.
  const [distance, setDistance] = useState(48);
  const landedRef = useRef(false);
  const exitingRef = useRef(false);
  const entranceRef = useRef<Animated.CompositeAnimation | null>(null);
  const messageRef = useRef<View>(null);
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
  });

  useEffect(() => {
    if (landedRef.current) return;
    const land = () => {
      // Pinned explicitly: a re-render must not depend on the native driver
      // having synced its end values back to JS.
      landedRef.current = true;
      [page, rise, words, button, settle].forEach((v) => v.setValue(1));
      onSettledRef.current();
    };
    // Also the way out of an entrance stopped half-way by reduce motion.
    if (reduceMotion) {
      land();
      return;
    }
    const after = (delay: number, anim: Animated.CompositeAnimation) =>
      Animated.sequence([Animated.delay(delay), anim]);
    const anim = Animated.parallel([
      Animated.timing(page, {
        toValue: 1,
        duration: PAGE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      after(
        RISE_DELAY_MS,
        Animated.timing(rise, {
          toValue: 1,
          duration: RISE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      ),
      after(
        WORDS_DELAY_MS,
        Animated.sequence([
          Animated.timing(settle, {
            toValue: 1.04,
            duration: SETTLE_GROW_MS,
            useNativeDriver: true,
          }),
          Animated.spring(settle, {
            toValue: 1,
            stiffness: 800,
            damping: 34,
            useNativeDriver: true,
          }),
        ])
      ),
      after(
        WORDS_DELAY_MS,
        Animated.timing(words, {
          toValue: 1,
          duration: WORDS_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      ),
      after(
        BUTTON_DELAY_MS,
        Animated.timing(button, {
          toValue: 1,
          duration: BUTTON_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      ),
    ]);
    entranceRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) land();
    });
    return () => anim.stop();
  }, [reduceMotion, page, rise, words, button, settle]);

  const motion = useMemo(
    () => ({
      numberOpacity: rise.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
      numberY: rise.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }),
      wordsY: words.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
    }),
    [rise, words, distance]
  );

  const exit = () => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    // Closed during the entrance: it must not land and pin the page back.
    entranceRef.current?.stop();
    if (reduceMotion) {
      onClose();
      return;
    }
    Animated.timing(page, {
      toValue: 0,
      duration: EXIT_MS,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => onClose());
  };

  // Screen readers land on the message, read as one sentence. Focus only:
  // announcing it as well would read it twice.
  const focusMessage = () => {
    const send = () => {
      if (messageRef.current) AccessibilityInfo.sendAccessibilityEvent(messageRef.current, 'focus');
    };
    if (messageRef.current) send();
    else requestAnimationFrame(send);
  };

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={exit}
      onShow={focusMessage}
    >
      <Animated.View
        testID="celebration"
        style={[styles.page, { backgroundColor: colors.background, opacity: page }]}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxl }]}
        >
          <View ref={messageRef} accessible accessibilityLabel={copy.spoken} style={styles.message}>
            <Animated.Text
              testID="celebration-number"
              numberOfLines={1}
              adjustsFontSizeToFit
              // Already very large; the words below it scale without a cap.
              maxFontSizeMultiplier={1.3}
              onLayout={(e) => setDistance(e.nativeEvent.layout.height / 2)}
              style={[
                styles.number,
                {
                  color: colors.text,
                  opacity: motion.numberOpacity,
                  transform: [{ translateY: motion.numberY }, { scale: settle }],
                },
              ]}
            >
              {copy.number}
            </Animated.Text>
            <Animated.View
              style={[styles.words, { opacity: words, transform: [{ translateY: motion.wordsY }] }]}
            >
              <Text style={[styles.unit, { color: colors.textMuted }]}>日連続</Text>
              <Text style={[styles.headline, { color: colors.text }]}>{copy.headline}</Text>
              <Text style={[styles.line, { color: colors.textMuted }]}>{copy.line}</Text>
              {copy.longest && (
                <Text style={[styles.line, { color: colors.textMuted }]}>{copy.longest}</Text>
              )}
            </Animated.View>
          </View>
        </ScrollView>
        {/* Pinned below the scrolling message, so it stays in reach at large font sizes. */}
        <Animated.View
          style={[styles.footer, { opacity: button, paddingBottom: insets.bottom + space.lg }]}
        >
          <PressableScale
            testID="celebration-close"
            accessibilityLabel="閉じる"
            onPress={exit}
            style={[styles.close, { borderColor: colors.text }]}
          >
            <Text style={[styles.closeText, { color: colors.text }]}>閉じる</Text>
          </PressableScale>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingBottom: space.xl,
  },
  message: {
    alignItems: 'center',
  },
  number: {
    fontSize: typography.size.display,
    lineHeight: typography.size.display + 8,
    fontWeight: typography.weight.light,
    fontVariant: ['tabular-nums'],
  },
  words: {
    alignItems: 'center',
  },
  unit: {
    fontSize: typography.size.title,
  },
  headline: {
    marginTop: space.xl,
    fontSize: typography.size.heading,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
  },
  line: {
    marginTop: space.sm,
    fontSize: typography.size.button,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
  footer: {
    alignItems: 'center',
    paddingTop: space.md,
  },
  close: {
    minHeight: 48,
    minWidth: 160,
    paddingHorizontal: space.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
  },
  closeText: {
    fontSize: typography.size.title,
    fontWeight: typography.weight.medium,
  },
});
