import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EntryInput } from '../components/EntryInput';
import { STREAK_IN_PLACE_MS, StreakDisplay, StreakDay } from '../components/StreakDisplay';
import { CelebrationModal } from '../components/CelebrationModal';
import { FADE_MS, LongestTodayLine } from '../components/LongestTodayLine';
import { StreakRepairLine } from '../components/StreakRepairLine';
import { PressableScale } from '../components/PressableScale';
import { useEntries } from '../contexts/EntriesContext';
import { useCelebration } from '../hooks/useCelebration';
import { useExportReminder } from '../hooks/useExportReminder';
import { useKeyboardShown } from '../hooks/useKeyboardShown';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useScreenReaderEnabled } from '../hooks/useScreenReaderEnabled';
import { longestTodayCopy } from '../services/celebrationCopy';
import { promptFor } from '../services/promptCopy';
import { addDays } from '../utils/date';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { space } from '../theme/spacing';
import { radius } from '../theme/radius';

export const SAVED_FEEDBACK_MS = 1500;
const BG_TRANSITION_MS = 250;
const LAYOUT_TRANSITION_MS = 250;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Android で LayoutAnimation を有効化 (一度だけ)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Material Design Standard easing (easeInOut) 相当の幅遷移
function animateButtonLayout(reduceMotion: boolean) {
  if (reduceMotion) return;
  LayoutAnimation.configureNext({
    duration: LAYOUT_TRANSITION_MS,
    update: { type: 'easeInEaseOut' },
  });
}

function formatJpDate(dateStr: string): { md: string; dow: string } {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const md = `${m}月${d}日`;
  const dow = `${weekdays[date.getDay()]}曜日`;
  return { md, dow };
}

export function HomeScreen() {
  const colors = useColors();
  const {
    ready,
    initError,
    retryInit,
    getByDate,
    upsert,
    streak,
    entries,
    todayStr,
    streakBreak,
    declineRepair,
  } = useEntries();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const screenReader = useScreenReaderEnabled();
  // The repair offer steps aside while the keyboard is up; the text field
  // moves with it smoothly rather than in one jump.
  const keyboardShown = useKeyboardShown(() => {
    if (streakBreak.offer) animateButtonLayout(reduceMotion);
  });
  const { remindAfterSave } = useExportReminder();
  const reduceMotion = useReduceMotion();
  const isFocused = useIsFocused();
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The Streak just before the save in progress, so the announcement can say
  // when it grew.
  const streakBeforeSaveRef = useRef<number | null>(null);

  // 保存ボタンのアニメーション
  // bgPhase: 0 = primary (有効。保存しました の間も), 1 = disabled (空欄)
  // The saved state keeps the primary fill; the checkmark carries it.
  const bgPhase = useRef(new Animated.Value(0)).current;
  const tapScale = useRef(new Animated.Value(1)).current;

  // todayStr follows the date across midnight and app resumes (from the
  // provider, so the number, the dots and a repair offer share one day), and a
  // save after midnight goes to the new day.
  const { md, dow } = formatJpDate(todayStr);
  // The full-screen celebration of a Milestone or a new Longest streak.
  const celebration = useCelebration({ enabled: isFocused && ready && loaded, todayStr });

  const last7: StreakDay[] = useMemo(() => {
    const recordedSet = new Set(entries.map((e) => e.date));
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(todayStr, -(6 - i));
      return { date: d, recorded: recordedSet.has(d), isToday: d === todayStr };
    });
  }, [entries, todayStr]);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const e = await getByDate(todayStr);
      setText(e?.text ?? '');
      setLoaded(true);
    })();
  }, [ready, todayStr, getByDate]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const isEmpty = text.trim().length === 0;

  // Announced once the saved state and the new Streak have both rendered. A
  // due full-screen celebration tells the Streak itself, so the count is left
  // to it; a new Longest streak alone is told in the same announcement.
  const celebrationDue = celebration.due;
  const longestDue = celebration.longestDue;
  const longestAnnouncedRef = useRef<string | null>(null);
  useEffect(() => {
    const before = streakBeforeSaveRef.current;
    if (!justSaved || before === null) return;
    streakBeforeSaveRef.current = null;
    let message = streak > before && !celebrationDue ? `保存しました。${streak}日連続` : '保存しました';
    if (streak > before && longestDue) {
      message += `。${longestTodayCopy(longestDue.previousLongest).spoken}`;
      longestAnnouncedRef.current = longestDue.key;
    }
    AccessibilityInfo.announceForAccessibility(message);
  }, [justSaved, streak, celebrationDue, longestDue]);

  // Streak repair. The offer steps aside while the keyboard is up: Home does
  // not scroll, and it asks for nothing while today is being written.
  const offer = keyboardShown ? null : streakBreak.offer;
  const streakRef = useRef<View>(null);
  const longestLineRef = useRef<View>(null);
  const repairOpenedFor = useRef<string | null>(null);
  const focusLongestKey = useRef<string | null>(null);
  const focusOn = (ref: React.RefObject<View | null>) => {
    if (ref.current) AccessibilityInfo.sendAccessibilityEvent(ref.current, 'focus');
  };

  const writeYesterday = () => {
    if (!offer) return;
    repairOpenedFor.current = offer.missingDay;
    // Home stays mounted, so today's draft is kept.
    navigation.navigate('EntryEditor', { date: offer.missingDay });
  };

  const closeOffer = () => {
    if (!offer) return;
    animateButtonLayout(reduceMotion);
    declineRepair(offer.missingDay);
    // The pressed button is gone: TalkBack lands on the Streak.
    if (screenReader) requestAnimationFrame(() => focusOn(streakRef));
  };

  // Back in front after writing yesterday: TalkBack is taken to the result (the
  // Streak, or a new Longest streak's line) instead of the button that is gone.
  // A Milestone's full screen takes focus itself.
  useEffect(() => {
    if (!isFocused) return;
    const day = repairOpenedFor.current;
    repairOpenedFor.current = null;
    if (!day || !screenReader || !entries.some((e) => e.date === day)) return;
    if (celebration.due) return;
    if (celebration.longestDue) {
      focusLongestKey.current = celebration.longestDue.key;
      return;
    }
    const timer = setTimeout(() => focusOn(streakRef), STREAK_IN_PLACE_MS);
    return () => clearTimeout(timer);
    // Only on coming back into focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  // A new Longest streak alone that no save announced (written from History):
  // told when its line appears, or focused when a repair from Home made it.
  const longestToday = celebration.longestToday;
  useEffect(() => {
    if (!longestToday || longestAnnouncedRef.current === longestToday.key) return;
    longestAnnouncedRef.current = longestToday.key;
    if (focusLongestKey.current === longestToday.key) {
      focusLongestKey.current = null;
      // Once it has faded in: TalkBack skips a view that is still transparent.
      setTimeout(() => focusOn(longestLineRef), FADE_MS);
      return;
    }
    AccessibilityInfo.announceForAccessibility(
      longestTodayCopy(longestToday.previousLongest).spoken
    );
  }, [longestToday]);

  useEffect(() => {
    const target = isEmpty && !justSaved ? 1 : 0;
    // backgroundColor cannot be interpolated on RN's native driver, so this
    // animation must run on the JS driver. The transform animation (tapScale)
    // is split out into the <Animated.View> below to use the native driver —
    // two drivers, one per property.
    Animated.timing(bgPhase, {
      toValue: target,
      duration: reduceMotion ? 0 : BG_TRANSITION_MS,
      useNativeDriver: false,
    }).start();
  }, [justSaved, isEmpty, bgPhase, reduceMotion]);

  const handlePressIn = useCallback(() => {
    if (reduceMotion) return;
    Animated.spring(tapScale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }, [tapScale, reduceMotion]);

  const handlePressOut = useCallback(() => {
    if (reduceMotion) {
      // Reduce motion may have turned on mid-press; don't leave it shrunk.
      tapScale.setValue(1);
      return;
    }
    Animated.spring(tapScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  }, [tapScale, reduceMotion]);

  if (initError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{initError}</Text>
        <PressableScale
          onPress={retryInit}
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.buttonText, { color: colors.primaryText }]}>再試行</Text>
        </PressableScale>
      </SafeAreaView>
    );
  }

  if (!ready || !loaded) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.loadingMessage }}>読み込み中…</Text>
      </SafeAreaView>
    );
  }

  const handleChangeText = (next: string) => {
    setText(next);
    if (justSaved) {
      animateButtonLayout(reduceMotion);
      setJustSaved(false);
    }
  };

  const handleSave = async () => {
    if (text.trim().length === 0) return;
    try {
      // saving 中もラベルは "保存" のまま、disabled 状態だけが変わる (二重タップ防止)
      setSaving(true);
      streakBeforeSaveRef.current = streak;
      const headlineBeforeSave = streakBreak.headline;
      await upsert(todayStr, text);
      // "保存" → "✓ 保存しました" の幅変化を滑らかに. Not when the Streak comes back
      // from 「また今日から」 or a blank in the same commit: the layout animation
      // would slide that row sideways, and the number's rise is the moment.
      if (headlineBeforeSave === 'count') animateButtonLayout(reduceMotion);
      setJustSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => {
        animateButtonLayout(reduceMotion); // "✓ 保存しました" → "保存"
        setJustSaved(false);
        // The backup reminder waits until the save has been celebrated (and a
        // full-screen celebration closed), so its dialog does not cover them.
        // fire-and-forget: Alert 待ちで saving 状態を占有しない (エラーはフック内で処理)
        celebration.afterCelebration(() => void remindAfterSave(todayStr));
      }, SAVED_FEEDBACK_MS);
    } catch (e) {
      streakBeforeSaveRef.current = null;
      console.error('save failed', e);
      Alert.alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const buttonDisabled = saving || justSaved || isEmpty;

  const animatedBg = bgPhase.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.primary, colors.disabled],
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerBlock}>
        <View style={styles.header}>
          <View accessible accessibilityRole="header" accessibilityLabel={`${md} ${dow}`}>
            <Text style={[styles.dateMd, { color: colors.text }]}>{md}</Text>
            <Text style={[styles.dateDow, { color: colors.textMuted }]}>{dow}</Text>
          </View>
          <StreakDisplay
            ref={streakRef}
            days={streak}
            last7={last7}
            active={isFocused}
            headline={streakBreak.headline}
          />
        </View>
        {/* Under the Streak, across the full width so it wraps well at large
            font sizes. */}
        {offer ? (
          <StreakRepairLine
            streakAfter={offer.streakAfter}
            onWrite={writeYesterday}
            onClose={closeOffer}
          />
        ) : longestToday ? (
          <LongestTodayLine ref={longestLineRef} previousLongest={longestToday.previousLongest} />
        ) : null}
      </View>

      <View style={styles.body}>
        {/* No autoFocus: the soft keyboard would hide the streak and the tab
            bar the moment Home opens. Tapping the input brings it up.
            The placeholder is the Prompt of the day (CONTEXT.md), so it is
            never saved, and it turns over with the date at midnight. */}
        <EntryInput
          value={text}
          onChangeText={handleChangeText}
          label="今日の一文"
          placeholder={promptFor(todayStr)}
          fill
        />
      </View>

      <View style={[styles.footer, { borderTopColor: colors.divider }]}>
        {/* native driver の transform と JS driver の backgroundColor を分離するため Animated.View でラップ */}
        <Animated.View style={{ transform: [{ scale: tapScale }] }}>
          <AnimatedPressable
            testID={justSaved ? 'save-button-saved' : 'save-button'}
            onPress={handleSave}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={buttonDisabled}
            accessibilityRole="button"
            accessibilityLabel={justSaved ? '保存しました' : '保存'}
            accessibilityState={{ disabled: buttonDisabled }}
            style={[styles.saveButton, { backgroundColor: animatedBg }]}
          >
            {justSaved ? (
              <SavedLabel color={colors.primaryText} reduceMotion={reduceMotion} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primaryText }]}>保存</Text>
            )}
          </AnimatedPressable>
        </Animated.View>
      </View>
      <CelebrationModal
        celebration={celebration.showing}
        onSettled={celebration.settled}
        onClose={celebration.close}
      />
    </SafeAreaView>
  );
}

// "保存しました" with a checkmark that pops in, so the saved state reads without
// a colour change.
function SavedLabel({ color, reduceMotion }: { color: string; reduceMotion: boolean }) {
  const pop = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      // Also lands a pop that was stopped half-way by reduce motion.
      pop.setValue(1);
      return;
    }
    const anim = Animated.spring(pop, {
      toValue: 1,
      stiffness: 800,
      damping: 34,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [pop, reduceMotion]);

  return (
    <View style={styles.savedRow}>
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <Ionicons name="checkmark" size={14} color={color} importantForAccessibility="no" />
      </Animated.View>
      <Text style={[styles.buttonText, { color }]}>保存しました</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: space.lg + 2,
    paddingTop: space.xl,
    paddingBottom: space.lg + 2,
  },
  headerBlock: {
    gap: space.sm,
    marginBottom: space.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dateMd: {
    fontSize: typography.size.title,
    fontWeight: typography.weight.medium,
  },
  dateDow: {
    fontSize: typography.size.caption,
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: space.md + 2,
    borderTopWidth: 1,
  },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
  },
  retryButton: {
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
    alignSelf: 'center',
  },
  buttonText: {
    fontSize: typography.size.button,
    fontWeight: typography.weight.medium,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  errorText: {
    marginBottom: space.lg,
    textAlign: 'center',
  },
});
