# 一口日記 ミニマル UX/デザイン刷新 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存 MVP のビジュアルを「日本語サンセリフ・モノクロ・本文ヒーロー」のミニマル路線に統一し、本文 22px 化・残り字数の位置変更・チャット型タイムライン・ストリーク表示の刷新を行う。

**Architecture:** 機能仕様・データ層は一切変更せず、theme トークン (`src/theme/`) を更新し、各 screen / component が新トークンを参照する形でビジュアルを差し替える。`StreakBadge` → `StreakDisplay`、`EntryCard` → `TimelineRow` の置換で構造もクリーン化。

**Tech Stack:** React Native 0.81 + Expo SDK 54 / TypeScript / 既存テスト基盤 (Jest + jest-expo + @testing-library/react-native)

---

## 仕様書

`docs/superpowers/specs/2026-04-28-minimal-redesign-design.md` を必ず参照すること。

---

## ファイル構成 (作成・変更・削除するファイル)

```
src/
├─ theme/
│   ├─ colors.ts              (modify: 値を全面更新、型はそのまま)
│   ├─ typography.ts          (create: フォントサイズ/weight/lineHeight)
│   ├─ spacing.ts             (create: 8px ベースの間隔スケール)
│   ├─ radius.ts              (create: 角丸スケール)
│   └─ useColors.ts           (変更なし)
├─ components/
│   ├─ EntryInput.tsx         (modify: 22px、border 廃止)
│   ├─ EntryInput.test.tsx    (verify: 既存テストが通ることを確認)
│   ├─ StreakBadge.tsx        (DELETE)
│   ├─ StreakBadge.test.tsx   (DELETE)
│   ├─ EntryCard.tsx          (DELETE)
│   ├─ StreakDisplay.tsx      (create: 数字 + 7ドット + ラベル、TDD)
│   ├─ StreakDisplay.test.tsx (create: TDD)
│   ├─ TimelineRow.tsx        (create: 左日付 + 右本文の行)
│   └─ PressableScale.tsx     (変更なし)
├─ screens/
│   ├─ HomeScreen.tsx         (modify: 本文ヒーローレイアウト、StreakDisplay 使用)
│   ├─ HistoryScreen.tsx      (modify: FlatList inverted、TimelineRow 使用、calendar theme 更新)
│   ├─ SettingsScreen.tsx     (modify: 色のみ更新)
│   ├─ EntryEditorModal.tsx   (modify: 色のみ更新)
│   └─ LockScreen.tsx         (modify: タイトルサイズ縮小、色更新)
└─ navigation/
    └─ RootNavigator.tsx      (modify: TabBar tint 色更新)
```

---

## 規約

### コミット
- VCS は **jj (jujutsu)**。`git commit` ではなく `jj commit -m "..."` (jj は自動でファイルをトラックする)
- コミットメッセージは **日本語**
- タスクの最後の Step で 1 コミット

### コード
- 識別子・関数名・文字列リテラルは英語、日本語ユーザー向け文字列はそのまま
- コメントは原則書かない (仕様書の WHY を残す必要があるときのみ日本語で 1 行)
- TypeScript strict mode

### テスト
- 既存テスト 58 件は引き続き全て PASS であること
- 新規追加: StreakDisplay の TDD テスト (5 件想定)
- 削除: StreakBadge.test.tsx (3 件、コンポーネント廃止に伴う)
- 最終的に **60 件前後** の PASS が想定状態

### コマンド (Windows / bash)
- `npx tsc --noEmit` 必ず exit 0 を維持
- `npm test` も全 PASS を維持

---

## Task 1: テーマトークン更新 (colors / typography / spacing / radius)

**Files:**
- Modify: `src/theme/colors.ts`
- Create: `src/theme/typography.ts`
- Create: `src/theme/spacing.ts`
- Create: `src/theme/radius.ts`

役割: ミニマル路線のデザイントークンを一括で確定。後続のすべての変更がこれを参照する。

- [ ] **Step 1: `colors.ts` を新トークンに置き換え**

`src/theme/colors.ts` を以下の内容で置き換え:

```ts
export type Colors = {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  textPlaceholder: string;
  border: string;
  divider: string;
  inputBorder: string;
  primary: string;
  primaryText: string;
  success: string;
  warning: string;
  danger: string;
  disabled: string;
  streakBg: string;
  streakText: string;
  error: string;
  loadingMessage: string;
};

export const lightColors: Colors = {
  background: '#ffffff',
  surface: '#fafafa',
  text: '#111111',
  textMuted: '#888888',
  textPlaceholder: '#bbbbbb',
  border: '#e8e8e8',
  divider: '#f0f0f0',
  inputBorder: '#e8e8e8',
  primary: '#111111',
  primaryText: '#ffffff',
  success: '#2e7d32',
  warning: '#ef6c00',
  danger: '#c62828',
  disabled: '#dddddd',
  streakBg: 'transparent',
  streakText: '#111111',
  error: '#c00000',
  loadingMessage: '#888888',
};

export const darkColors: Colors = {
  background: '#0d0d0d',
  surface: '#1a1a1a',
  text: '#ececec',
  textMuted: '#888888',
  textPlaceholder: '#666666',
  border: '#2a2a2a',
  divider: '#1f1f1f',
  inputBorder: '#2a2a2a',
  primary: '#ececec',
  primaryText: '#0d0d0d',
  success: '#66bb6a',
  warning: '#ffb74d',
  danger: '#ef5350',
  disabled: '#3a3a3a',
  streakBg: 'transparent',
  streakText: '#ececec',
  error: '#ef9a9a',
  loadingMessage: '#888888',
};
```

- [ ] **Step 2: `typography.ts` を作成**

`src/theme/typography.ts`:

```ts
export const typography = {
  size: {
    body: 22,
    streakNum: 18,
    title: 16,
    cardBody: 14,
    button: 13,
    caption: 11,
    micro: 9,
  },
  weight: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
  },
  lineHeight: {
    body: 1.7,
    cardBody: 1.6,
    default: 1.5,
  },
};
```

- [ ] **Step 3: `spacing.ts` を作成**

`src/theme/spacing.ts`:

```ts
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 32,
  xxxl: 48,
};
```

- [ ] **Step 4: `radius.ts` を作成**

`src/theme/radius.ts`:

```ts
export const radius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  full: 9999,
};
```

- [ ] **Step 5: 型チェック**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 6: テストが影響を受けないことを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test
```

期待: 全 PASS (色値の変更のみで挙動は不変)

- [ ] **Step 7: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "theme: ミニマル路線のトークンに更新 (colors値変更 + typography/spacing/radius新規)"
```

---

## Task 2: StreakDisplay コンポーネント (TDD)

**Files:**
- Create: `src/components/StreakDisplay.tsx`
- Test: `src/components/StreakDisplay.test.tsx`

役割: Home 画面の右上に表示する「数字 + 7ドット + ラベル」コンポーネント。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/StreakDisplay.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('../theme/useColors', () => {
  const { lightColors } = require('../theme/colors');
  return {
    useColors: () => lightColors,
    useIsDark: () => false,
  };
});

import { StreakDisplay } from './StreakDisplay';

const allRecorded = (todayStr: string) => {
  // 直近7日全て記録ありのデータ (旅日付の整合は問わない、形だけ揃える)
  return Array.from({ length: 7 }, (_, i) => ({
    date: `2026-04-${22 + i}`,
    recorded: true,
    isToday: i === 6,
  }));
};

describe('StreakDisplay', () => {
  test('shows the streak number', () => {
    const { getByText } = render(<StreakDisplay days={7} last7={allRecorded('2026-04-28')} />);
    expect(getByText('7')).toBeTruthy();
    expect(getByText('日連続')).toBeTruthy();
  });

  test('shows 0 when days=0', () => {
    const last7 = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${22 + i}`,
      recorded: false,
      isToday: i === 6,
    }));
    const { getByText } = render(<StreakDisplay days={0} last7={last7} />);
    expect(getByText('0')).toBeTruthy();
  });

  test('renders 7 dots with correct testIDs', () => {
    const { getByTestId } = render(<StreakDisplay days={7} last7={allRecorded('2026-04-28')} />);
    for (let i = 0; i < 7; i++) {
      expect(getByTestId(`streak-dot-${i}`)).toBeTruthy();
    }
  });

  test('shows the "直近7日" label', () => {
    const { getByText } = render(<StreakDisplay days={7} last7={allRecorded('2026-04-28')} />);
    expect(getByText('直近7日')).toBeTruthy();
  });

  test('renders dots even when streak is 0', () => {
    const last7 = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${22 + i}`,
      recorded: false,
      isToday: i === 6,
    }));
    const { getByTestId } = render(<StreakDisplay days={0} last7={last7} />);
    expect(getByTestId('streak-dot-6')).toBeTruthy();
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/components/StreakDisplay.test.tsx
```

期待: モジュール解決エラー (`Cannot find module './StreakDisplay'`)

- [ ] **Step 3: 実装を書く**

`src/components/StreakDisplay.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

export type StreakDay = {
  date: string;
  recorded: boolean;
  isToday: boolean;
};

type Props = {
  days: number;
  last7: StreakDay[];
};

export function StreakDisplay({ days, last7 }: Props) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const prevDaysRef = useRef(days);

  useEffect(() => {
    if (days > prevDaysRef.current) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 140, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 80 }),
      ]).start();
    }
    prevDaysRef.current = days;
  }, [days, scale]);

  return (
    <View style={styles.container}>
      <View style={styles.numRow}>
        <Animated.Text
          style={[
            styles.num,
            { color: colors.text, transform: [{ scale }] },
          ]}
        >
          {days}
        </Animated.Text>
        <Text style={[styles.suffix, { color: colors.textMuted }]}>日連続</Text>
      </View>
      <View style={styles.dots}>
        {last7.map((d, i) => (
          <View
            key={d.date}
            testID={`streak-dot-${i}`}
            style={[
              styles.dot,
              { backgroundColor: d.recorded ? colors.text : colors.border },
              d.isToday && {
                borderWidth: 1.5,
                borderColor: colors.text,
                backgroundColor: d.recorded ? colors.text : colors.border,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: colors.textMuted }]}>直近7日</Text>
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
  num: {
    fontSize: typography.size.streakNum,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.streakNum,
  },
  suffix: {
    fontSize: 10,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  label: {
    fontSize: typography.size.micro,
  },
});
```

- [ ] **Step 4: テストパスを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/components/StreakDisplay.test.tsx
```

期待: 全 5 件 PASS

- [ ] **Step 5: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "StreakDisplay: 数字+7ドット+ラベルのストリーク表示コンポーネント追加"
```

---

## Task 3: TimelineRow コンポーネント

**Files:**
- Create: `src/components/TimelineRow.tsx`

役割: 履歴タイムライン用、左に大日付 + 右に本文の単純な行。テストは仕様 §7.1 通り省略。

- [ ] **Step 1: 実装を書く**

`src/components/TimelineRow.tsx`:

```tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Entry } from '../types';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { space } from '../theme/spacing';

type Props = {
  entry: Entry;
  onPress: (date: string) => void;
};

export function TimelineRow({ entry, onPress }: Props) {
  const colors = useColors();
  const [year, month, day] = entry.date.split('-');
  void year;

  return (
    <Pressable
      onPress={() => onPress(entry.date)}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.divider },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.dateBlock}>
        <Text style={[styles.day, { color: colors.text }]}>{Number(day)}</Text>
        <Text style={[styles.mon, { color: colors.textMuted }]}>{Number(month)}月</Text>
      </View>
      <Text style={[styles.text, { color: colors.text }]}>{entry.text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.lg + 2,
    borderBottomWidth: 1,
  },
  pressed: { opacity: 0.6 },
  dateBlock: {
    minWidth: 38,
    alignItems: 'center',
  },
  day: {
    fontSize: typography.size.streakNum,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.streakNum,
  },
  mon: {
    fontSize: typography.size.micro,
    marginTop: 2,
  },
  text: {
    flex: 1,
    fontSize: typography.size.cardBody,
    lineHeight: typography.size.cardBody * typography.lineHeight.cardBody,
  },
});
```

- [ ] **Step 2: 型チェック**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "TimelineRow: 履歴タイムライン用の行コンポーネント追加"
```

---

## Task 4: EntryInput refactor (本文 22px、border 廃止)

**Files:**
- Modify: `src/components/EntryInput.tsx`
- Verify: `src/components/EntryInput.test.tsx` (変更しないが PASS 確認)

役割: 本文サイズを 22px に拡大、border 全廃。残り字数の警告色ロジックは継続。

- [ ] **Step 1: `EntryInput.tsx` を以下に置き換え**

`src/components/EntryInput.tsx`:

```tsx
import React, { useCallback } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { countChars, stripNewlines } from '../utils/text';
import { MAX_TEXT_LENGTH } from '../types';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

const WARNING_THRESHOLD = 20;
const DANGER_THRESHOLD = 10;

export function EntryInput({
  value,
  onChangeText,
  placeholder = '今日の一文を書く',
  autoFocus,
}: Props) {
  const colors = useColors();

  const handleChange = useCallback(
    (next: string) => {
      const cleaned = stripNewlines(next);
      if (countChars(cleaned) > MAX_TEXT_LENGTH) return;
      onChangeText(cleaned);
    },
    [onChangeText]
  );

  const remaining = MAX_TEXT_LENGTH - countChars(value);

  let countColor = colors.textMuted;
  let countWeight: '400' | '600' = '400';
  if (remaining <= DANGER_THRESHOLD) {
    countColor = colors.danger;
    countWeight = '600';
  } else if (remaining <= WARNING_THRESHOLD) {
    countColor = colors.warning;
  }

  return (
    <View style={styles.container}>
      <Text
        testID="remaining-count"
        style={[styles.count, { color: countColor, fontWeight: countWeight }]}
      >
        残り {remaining} 字
      </Text>
      <TextInput
        testID="entry-input"
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textPlaceholder}
        autoFocus={autoFocus}
        multiline={false}
        style={[styles.input, { color: colors.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flex: 1,
  },
  input: {
    fontSize: typography.size.body,
    lineHeight: typography.size.body * typography.lineHeight.body,
    padding: 0,
    flex: 1,
  },
  count: {
    alignSelf: 'flex-end',
    fontSize: typography.size.caption,
    marginBottom: 6,
  },
});
```

主な差分:
- count を input の **上** に移動
- input から border / borderRadius / backgroundColor / minHeight を全廃
- input に `flex: 1` を持たせ、container も `flex: 1` で親領域いっぱいに広がる

- [ ] **Step 2: 既存テストが PASS することを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/components/EntryInput.test.tsx
```

期待: 5 件全 PASS (count のテキスト「残り N 字」と countChars の挙動は不変)

- [ ] **Step 3: 型チェック**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 4: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "EntryInput: 本文22px化、border全廃、count位置を本文の上に移動"
```

---

## Task 5: HomeScreen 再構成 (本文ヒーローレイアウト + StreakDisplay)

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

役割: 本文を主役に、ストリーク表示を `StreakDisplay` に置換、保存ボタンを右下控えめに配置。

- [ ] **Step 1: 実装を書き換え**

`src/screens/HomeScreen.tsx`:

```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, View } from 'react-native';
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

  const isEmpty = text.trim().length === 0;
  const buttonDisabled = saving || justSaved || isEmpty;
  const buttonLabel = saving ? '保存中…' : justSaved ? '✓ 保存しました' : '保存';
  const buttonBg = justSaved
    ? colors.success
    : saving || isEmpty
      ? colors.disabled
      : colors.primary;

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
        <PressableScale
          onPress={handleSave}
          disabled={buttonDisabled}
          style={[styles.saveButton, { backgroundColor: buttonBg }]}
        >
          <Text style={[styles.buttonText, { color: colors.primaryText }]}>{buttonLabel}</Text>
        </PressableScale>
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
```

- [ ] **Step 2: 型チェック**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: テスト全 PASS 確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test
```

期待: 全 PASS (HomeScreen はテスト無し、影響を受けるのは EntryInput / StreakDisplay のみで PASS 継続)

- [ ] **Step 4: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "HomeScreen: 本文ヒーローレイアウトに再構成、StreakDisplay使用、保存ボタンを右下に配置"
```

---

## Task 6: HistoryScreen 再構成 (FlatList inverted + TimelineRow + Calendar theme 更新)

**Files:**
- Modify: `src/screens/HistoryScreen.tsx`

役割: タイムラインを下=最新のチャット型に、TimelineRow を使用、calendar のテーマをモノクロに更新。

- [ ] **Step 1: 実装を書き換え**

`src/screens/HistoryScreen.tsx`:

```tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Animated,
  FlatList,
  LayoutChangeEvent,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEntries } from '../contexts/EntriesContext';
import { useSettings } from '../contexts/SettingsContext';
import { TimelineRow } from '../components/TimelineRow';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { space } from '../theme/spacing';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HistoryScreen() {
  const colors = useColors();
  const navigation = useNavigation<Nav>();
  const { entries, getDatesInMonth } = useEntries();
  const { settings, updateSettings } = useSettings();

  const [marked, setMarked] = useState<Record<string, { marked: boolean; dotColor?: string }>>({});
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const indicatorAnim = useRef(
    new Animated.Value(settings.viewMode === 'calendar' ? 0 : 1)
  ).current;
  const [tabsWidth, setTabsWidth] = useState(0);

  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: settings.viewMode === 'calendar' ? 0 : 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [settings.viewMode, indicatorAnim]);

  const loadMonth = useCallback(
    async (y: number, m: number) => {
      const dates = await getDatesInMonth(y, m);
      const map: Record<string, { marked: boolean; dotColor?: string }> = {};
      for (const d of dates) {
        map[d] = { marked: true, dotColor: colors.text };
      }
      setMarked(map);
    },
    [getDatesInMonth, colors.text]
  );

  useEffect(() => {
    loadMonth(year, month);
  }, [year, month, loadMonth, entries]);

  const openEditor = (date: string) => {
    navigation.navigate('EntryEditor', { date });
  };

  const calendarTheme = {
    backgroundColor: colors.background,
    calendarBackground: colors.background,
    textSectionTitleColor: colors.textMuted,
    selectedDayBackgroundColor: colors.text,
    selectedDayTextColor: colors.background,
    todayTextColor: colors.text,
    todayBackgroundColor: colors.surface,
    dayTextColor: colors.text,
    textDisabledColor: colors.disabled,
    dotColor: colors.text,
    selectedDotColor: colors.background,
    arrowColor: colors.text,
    monthTextColor: colors.text,
    indicatorColor: colors.text,
  };

  const tabWidth = tabsWidth / 2;
  // indicator width = tabWidth * 0.75 → 各タブの中央に置くため左右に tabWidth * 0.125 のインセット
  const indicatorTranslate = indicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [tabWidth * 0.125, tabWidth * 1.125],
  });

  const onTabsLayout = (e: LayoutChangeEvent) => {
    setTabsWidth(e.nativeEvent.layout.width);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.toggleWrapper, { borderBottomColor: colors.divider }]}
        onLayout={onTabsLayout}
      >
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => updateSettings({ viewMode: 'calendar' })}
            style={styles.tab}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: settings.viewMode === 'calendar' ? colors.text : colors.textMuted,
                  fontWeight:
                    settings.viewMode === 'calendar'
                      ? typography.weight.medium
                      : typography.weight.regular,
                },
              ]}
            >
              カレンダー
            </Text>
          </Pressable>
          <Pressable
            onPress={() => updateSettings({ viewMode: 'timeline' })}
            style={styles.tab}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: settings.viewMode === 'timeline' ? colors.text : colors.textMuted,
                  fontWeight:
                    settings.viewMode === 'timeline'
                      ? typography.weight.medium
                      : typography.weight.regular,
                },
              ]}
            >
              タイムライン
            </Text>
          </Pressable>
        </View>
        {tabsWidth > 0 && (
          <Animated.View
            style={[
              styles.indicator,
              {
                width: tabWidth * 0.75,
                backgroundColor: colors.text,
                transform: [{ translateX: indicatorTranslate }],
              },
            ]}
          />
        )}
      </View>

      {settings.viewMode === 'calendar' ? (
        <Calendar
          key={colors.background}
          markedDates={marked}
          theme={calendarTheme}
          onDayPress={(day: DateData) => openEditor(day.dateString)}
          onMonthChange={(d: DateData) => {
            setYear(d.year);
            setMonth(d.month);
          }}
        />
      ) : (
        <FlatList
          inverted
          data={entries}
          keyExtractor={(item) => item.date}
          renderItem={({ item }) => <TimelineRow entry={item} onPress={openEditor} />}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              まだ記録がありません
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toggleWrapper: {
    paddingTop: space.sm,
    position: 'relative',
    borderBottomWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    // 横 padding は付けない (indicator の translateX が toggleWrapper 全幅を前提にしている)
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabText: {
    fontSize: typography.size.button,
  },
  indicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    height: 2,
  },
  empty: {
    textAlign: 'center',
    marginTop: space.xxl,
    fontSize: typography.size.button,
  },
});
```

主な変更:
- `EntryCard` import 削除、`TimelineRow` import 追加
- `FlatList` に `inverted` prop 追加
- `markedDates` の dotColor を `colors.text` (黒)
- calendar theme をモノクロ化 (selected = colors.text、selectedText = colors.background)
- タブの下線を「短く中央寄せ」(tabWidth × 0.75 幅、左 12.5% オフセット)

- [ ] **Step 2: 型チェック**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: テスト全 PASS 確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test
```

期待: 全 PASS

- [ ] **Step 4: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "HistoryScreen: タイムラインをFlatList inverted (下=最新) に、TimelineRow使用、calendarテーマをモノクロ化"
```

---

## Task 7: SettingsScreen 色更新

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

役割: 既存 layout を維持、色トークンを参照するよう更新済みなので「実質的に値が変わるだけ」。明示的な変更は無い (theme tokens 経由で自動反映)。動作確認のみ。

- [ ] **Step 1: 型チェックと全テスト**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit && npm test 2>&1 | tail -5
```

期待: 全 PASS

- [ ] **Step 2: SettingsScreen が新トークンを正しく反映するか目視確認**

`src/screens/SettingsScreen.tsx` を読んで、ハードコード色 (#xxxxxx 直書き) が残っていないか確認:

```bash
cd C:/Users/lu/work/one-sentence-diary-app && grep -n "#[0-9a-fA-F]" src/screens/SettingsScreen.tsx 2>&1 || echo "no hardcoded colors"
```

期待: ハードコード色なし (すべて colors.* 経由)

万一ハードコード色がある場合は `colors.primary` 等に置換する。

- [ ] **Step 3: コミット (差分なしならスキップ可)**

差分があった場合のみ:
```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "SettingsScreen: ハードコード色を新トークンに統一"
```

差分が無ければ、Task 1 のトークン更新で自動的に新ルックになっているので何もせず次へ。

---

## Task 8: EntryEditorModal 色更新

**Files:**
- Modify: `src/screens/EntryEditorModal.tsx`

役割: Task 7 と同じ — 既存実装が `useColors()` 経由で色を取っているため、Task 1 のトークン更新で自動反映。`EntryInput` を共用するため、本文サイズ 22px が自動で適用される。

- [ ] **Step 1: ハードコード色チェック**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && grep -n "#[0-9a-fA-F]" src/screens/EntryEditorModal.tsx 2>&1 || echo "no hardcoded colors"
```

期待: ハードコード色なし

- [ ] **Step 2: 型チェック・テスト確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit && npm test 2>&1 | tail -5
```

期待: 全 PASS

- [ ] **Step 3: コミット (差分があった場合のみ)**

差分なければスキップ。

---

## Task 9: LockScreen 更新 (タイトルサイズ縮小 + トークン適用)

**Files:**
- Modify: `src/screens/LockScreen.tsx`

役割: 「🔒 ロックされています」を 24px → 18px に縮小、weight 500 を適用、ミニマル感を強化。

- [ ] **Step 1: タイトル style を更新**

`src/screens/LockScreen.tsx` の styles.title を以下に置き換え:

```ts
title: {
  fontSize: 18,
  fontWeight: '500',
  marginBottom: 32,
},
```

(他の部分は変更不要。useColors() で色は自動反映)

具体的な edit:

```ts
// Before:
//   title: { fontSize: 24, marginBottom: 32 },
// After:
//   title: { fontSize: 18, fontWeight: '500', marginBottom: 32 },
```

- [ ] **Step 2: 型チェック・テスト確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit && npm test 2>&1 | tail -5
```

期待: 全 PASS

- [ ] **Step 3: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "LockScreen: タイトルを24→18px / weight 500 に縮小して静謐感を強化"
```

---

## Task 10: RootNavigator TabBar tint 更新

**Files:**
- Modify: `src/navigation/RootNavigator.tsx`

役割: TabBar のアクティブ tint が `colors.primary` (新値 = 黒/明色) を参照するため Task 1 で自動反映。確認のみ。

- [ ] **Step 1: 現状確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && grep -n "tabBarActiveTintColor\|tabBarInactiveTintColor" src/navigation/RootNavigator.tsx
```

期待: `colors.primary` / `colors.textMuted` を参照していることを確認。ハードコードがあれば置換する。

- [ ] **Step 2: 型チェック**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット (差分があった場合のみ)**

差分なければスキップ。

---

## Task 11: 廃止コンポーネントの削除 (StreakBadge / EntryCard)

**Files:**
- Delete: `src/components/StreakBadge.tsx`
- Delete: `src/components/StreakBadge.test.tsx`
- Delete: `src/components/EntryCard.tsx`

役割: HomeScreen と HistoryScreen が新コンポーネントに切り替わったので、旧コンポーネントを削除する。

- [ ] **Step 1: 参照が残っていないことを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && grep -rn "StreakBadge\|EntryCard" src/ --include="*.ts" --include="*.tsx"
```

期待: 自分自身 (定義) 以外で参照なし。もし import が残っているファイルがあれば、Task 5/6 で漏れているので戻って修正する。

- [ ] **Step 2: ファイルを削除**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && rm src/components/StreakBadge.tsx src/components/StreakBadge.test.tsx src/components/EntryCard.tsx
```

- [ ] **Step 3: 型チェック・テスト**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit && npm test 2>&1 | tail -5
```

期待:
- tsc エラーなし
- テスト件数: 58 - 3 (StreakBadge.test) + 5 (StreakDisplay.test) = **60 件 PASS**

- [ ] **Step 4: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "削除: 廃止コンポーネント StreakBadge / EntryCard / StreakBadge.test"
```

---

## Task 12: 最終 QA — Development Build で実機確認

**Files:** なし (確認作業のみ)

- [ ] **Step 1: 最終 tsc + テスト**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit && npm test 2>&1 | tail -5
```

期待: 60 件 PASS、tsc 0

- [ ] **Step 2: Development Build で再起動**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm run android
```

(または iOS/エミュレータ環境に応じて。Expo Dev Client が起動)

- [ ] **Step 3: 仕様書 §7.2 のチェックリスト 14 項目を実機で確認**

仕様書 (`docs/superpowers/specs/2026-04-28-minimal-redesign-design.md`) の §7.2 を順に確認:

- [ ] Home: 本文 22px で大きく見える
- [ ] Home: 残り字数が本文の上に表示される
- [ ] Home: ストリーク表示で直近 7 日が黒/灰のドット、今日のドットに輪郭
- [ ] Home: 保存ボタンが右下に控えめ
- [ ] History カレンダー: blue 全廃、完全モノクロ
- [ ] History タイムライン: 開いた瞬間に最新 (今日) が見える
- [ ] History タイムライン: 上スクロールで過去に遡る
- [ ] History タイムライン: カードの枠/影が消えてリスト型
- [ ] Settings: テーマ選択チェックが黒、エクスポートボタンが黒
- [ ] EntryEditor: 保存ボタンが黒、削除は赤のまま
- [ ] LockScreen: タイトルが控えめ、認証ボタンが黒
- [ ] Tab bar: アクティブ色が黒
- [ ] ダークモード: 全画面で primary が明色、青の名残なし
- [ ] ストリーク達成 (連続日数増加) でパルスアニメーション

- [ ] **Step 4: 軽微な調整があれば修正コミット**

QA で見つかった軽微な調整があれば、対応してから:
```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "QAフィードバック: <修正内容>"
```

修正なければスキップ。

---

## 完了基準

- [ ] 全 12 タスクの全 Step がチェック済み
- [ ] `npx tsc --noEmit` がエラーなし
- [ ] `npm test` が **60 件 PASS** (旧 58 - 3 + 5 = 60)
- [ ] 仕様書 §7.2 の手動 QA チェックリスト 14 項目が全てクリア
- [ ] 旧 `StreakBadge.tsx` / `EntryCard.tsx` / `StreakBadge.test.tsx` が削除済み
- [ ] 全画面でハードコード色 (`#xxxxxx` 直書き) なし、`colors.*` 経由で統一
