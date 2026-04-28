import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EntryInput } from '../components/EntryInput';
import { StreakDisplay, StreakDay } from '../components/StreakDisplay';
import { PressableScale } from '../components/PressableScale';
import { useEntries } from '../contexts/EntriesContext';
import { today, addDays } from '../utils/date';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { space } from '../theme/spacing';
import { radius } from '../theme/radius';

const SAVED_FEEDBACK_MS = 1500;
const BG_TRANSITION_MS = 250;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const { ready, initError, retryInit, getByDate, upsert, streak, entries } = useEntries();
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 保存ボタンのアニメーション
  // bgPhase: 0 = primary (有効), 1 = disabled (無効/保存中), 2 = success (保存しました)
  const bgPhase = useRef(new Animated.Value(0)).current;
  const tapScale = useRef(new Animated.Value(1)).current;

  const todayStr = today();
  const { md, dow } = formatJpDate(todayStr);

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

  useEffect(() => {
    let target = 0;
    if (justSaved) target = 2;
    else if (saving || isEmpty) target = 1;
    Animated.timing(bgPhase, {
      toValue: target,
      duration: BG_TRANSITION_MS,
      useNativeDriver: false,
    }).start();
  }, [saving, justSaved, isEmpty, bgPhase]);

  const handlePressIn = useCallback(() => {
    Animated.spring(tapScale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }, [tapScale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(tapScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  }, [tapScale]);

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
    if (justSaved) setJustSaved(false);
  };

  const handleSave = async () => {
    if (text.trim().length === 0) return;
    try {
      setSaving(true);
      await upsert(todayStr, text);
      setJustSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setJustSaved(false), SAVED_FEEDBACK_MS);
    } catch (e) {
      console.error('save failed', e);
      Alert.alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const buttonDisabled = saving || justSaved || isEmpty;
  const buttonLabel = saving ? '保存中…' : justSaved ? '✓ 保存しました' : '保存';

  const animatedBg = bgPhase.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [colors.primary, colors.disabled, colors.success],
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.dateMd, { color: colors.text }]}>{md}</Text>
          <Text style={[styles.dateDow, { color: colors.textMuted }]}>{dow}</Text>
        </View>
        <StreakDisplay days={streak} last7={last7} />
      </View>

      <View style={styles.body}>
        <EntryInput value={text} onChangeText={handleChangeText} autoFocus />
      </View>

      <View style={[styles.footer, { borderTopColor: colors.divider }]}>
        {/* native driver の transform と JS driver の backgroundColor を分離するため Animated.View でラップ */}
        <Animated.View style={{ transform: [{ scale: tapScale }] }}>
          <AnimatedPressable
            onPress={handleSave}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={buttonDisabled}
            style={[styles.saveButton, { backgroundColor: animatedBg }]}
          >
            <Text style={[styles.buttonText, { color: colors.primaryText }]}>{buttonLabel}</Text>
          </AnimatedPressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: space.lg + 2,
    paddingTop: space.xl,
    paddingBottom: space.lg + 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space.xl,
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
  errorText: {
    marginBottom: space.lg,
    textAlign: 'center',
  },
});
