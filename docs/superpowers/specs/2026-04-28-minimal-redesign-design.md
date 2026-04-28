# 一口日記 ミニマル UX/デザイン刷新 設計仕様書

**作成日:** 2026-04-28
**作成者:** ブレインストーミング (Claude Code + ユーザー、Visual Companion 経由)
**ステータス:** 設計確定
**前提:** MVP 完成済み (`docs/superpowers/specs/2026-04-28-one-sentence-diary-app-design.md` 参照)

---

## 1. 概要

既存の MVP は機能要件をすべて満たしているが、視覚言語が「Material 寄りでカラフル」「本文の優先度が低く読みにくい」「ストリークが単なる数字表示で動機付けが弱い」という課題があった。

本仕様では **「日本語サンセリフ・モノクロ・本文ヒーロー」** のミニマル路線に統一し、毎日の入力体験を視覚的に格上げする。仕様変更ではなく **見た目とトークンの全面差し替え** が主軸。

### 1.1 設計の方針 (ブレストで確定済み)

| 項目 | 確定事項 |
|---|---|
| 全体方向 | **B. ミニマル・静謐** (Apple Notes / Bear ライク) |
| タイポ | **1. 全て日本語サンセリフ** (Hiragino Sans / Yu Gothic / system sans-serif) |
| ストリーク表示 | **A. 直近 7 日のドット** + 大きな数字 + ラベル |
| Home 階層 | **1. 本文ヒーロー型** (本文 22px / その他は控えめ) |
| 残り字数の位置 | **本文の上** (右寄せ、入力前に視認できる) |
| タイムライン並び | **下 = 最新** (チャット型)、初期スクロールは最下端 |
| カラー | モノクロ ベース、semantic 色 (success / warning / danger) は限定的に保持、**primary blue を全廃** |
| ダークモード | 既存の OS 追従 + テーマ選択 (システム / ライト / ダーク) はそのまま継続 |

### 1.2 スコープ外 (やらない)

- 機能仕様の変更 (1日1件 / 140字 / リマインダー / ロック / エクスポート 等は不変)
- データモデル / DB スキーマ / Repository / Service 層 (一切触らない)
- ナビゲーション構造 (Bottom Tabs + Modal は不変)
- アイコン / app.json (口・一の明朝アイコンは維持)
- アニメーション / マイクロインタラクション (PressableScale / カウンター警告色 / タブ下線スライド は継続。色だけモノクロ化)

---

## 2. デザイントークン

### 2.1 カラー (light)

```ts
export const lightColors: Colors = {
  background: '#ffffff',
  surface: '#fafafa',
  text: '#111111',          // 本文・主要 UI
  textMuted: '#888888',     // 副次的テキスト
  textPlaceholder: '#bbbbbb',
  border: '#e8e8e8',        // 入力欄ボーダー / ドット OFF
  divider: '#f0f0f0',       // 区切り線
  inputBorder: '#e8e8e8',   // = border に統一
  primary: '#111111',       // モノクロ (旧 #1976d2 を廃止)
  primaryText: '#ffffff',   // primary 上のテキスト
  success: '#2e7d32',       // 保存成功
  warning: '#ef6c00',       // 文字数警告 (残り 11-20 字)
  danger: '#c62828',        // 削除 / 文字数赤 (残り 0-10 字)
  disabled: '#dddddd',
  streakBg: 'transparent',  // 旧 #fff3e0 オレンジ背景は廃止
  streakText: '#111111',    // 旧オレンジ文字も黒に統一
  error: '#c00000',
  loadingMessage: '#888888',
};
```

### 2.2 カラー (dark)

```ts
export const darkColors: Colors = {
  background: '#0d0d0d',
  surface: '#1a1a1a',
  text: '#ececec',
  textMuted: '#888888',
  textPlaceholder: '#666666',
  border: '#2a2a2a',
  divider: '#1f1f1f',
  inputBorder: '#2a2a2a',
  primary: '#ececec',         // dark では明るい色が primary になる
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

**変更点 (旧 → 新):**
- `primary`: `#1976d2` (青) → `#111111` (黒) / dark は `#64b5f6` → `#ececec`
- `primaryText`: 不変 (`#ffffff` / `#0b1116`) — ただし dark では `#0d0d0d` に微調整
- `streakBg`/`streakText`: オレンジ系 → 透明背景 + 黒テキスト (バッジ廃止に伴い)
- `border` / `divider`: 既存値を整理、よりニュートラルなグレーに

### 2.3 タイポグラフィ

```ts
export const typography = {
  fontFamily: {
    // RN 側でプラットフォームごとに解決
    // iOS: 'Hiragino Sans'
    // Android: 'Roboto' (日本語は Noto Sans CJK)
    // 指定なし = システムデフォルト で OK
  },
  size: {
    body: 22,        // 本文 (input)
    streakNum: 18,   // ストリーク数字
    title: 16,       // 日付・見出し
    cardBody: 14,    // タイムライン本文
    button: 13,      // ボタン・タブラベル
    caption: 11,     // 残り字数・曜日
    micro: 9,        // 補助ラベル「直近7日」
  },
  weight: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
  },
  lineHeight: {
    body: 1.7,       // 本文 (input)
    cardBody: 1.6,   // タイムライン本文
    default: 1.5,
  },
};
```

### 2.4 間隔スケール (8px ベース)

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

**用途ガイド:**
- 画面 padding: `xl` (22) または `lg` (16)
- セクション間: `xl` (22) - `xxl` (32)
- カード/行内 padding: `md` (12) - `lg` (16)
- 同列要素間: `sm` (8) - `md` (12)

### 2.5 角丸

```ts
export const radius = {
  none: 0,
  xs: 2,    // タグ・微弱
  sm: 4,
  md: 6,    // ボタン
  lg: 8,    // カード・入力欄
  full: 9999,
};
```

**統一ルール:**
- ボタン: `md` (6)
- 入力欄: `lg` (8)
- 既存の混在 (8/12) を整理

### 2.6 トークンの実装場所

`src/theme/colors.ts` の `Colors` 型と light/dark 定義は既存のまま型を流用、**値だけ更新**。新規追加で:
- `src/theme/typography.ts` (新規)
- `src/theme/spacing.ts` (新規)
- `src/theme/radius.ts` (新規)

`useColors()` は変更なし (依然として SettingsContext 経由)。新規トークンは export const をそのまま import して使う。

---

## 3. 画面設計

### 3.1 HomeScreen (今日の一文)

```
┌─ 画面 padding: 22 / 18 / 18 ──────────────────┐
│                                                 │
│  4月28日              7 日連続                  │
│  火曜日              ⬛⬛⬛⬛⬛⬛⬛                │
│                       直近7日                    │
│                                                 │
│  ───────────────────  (space.xl = 22)         │
│                                  残り 124 字   │
│  桜が散って、新緑の季節が始まった。            │
│  (本文 22px / line-height 1.7 / 主役)          │
│                                                 │
│                                                 │
│                                                 │
│  ───────────────── (border-top divider) ─────  │
│                                       [保存]   │
└─────────────────────────────────────────────────┘
```

**コンポーネント構成:**

```
HomeScreen
├─ Header (flex-row, justify-space-between)
│  ├─ DateBlock (left)
│  │  ├─ Text "M月D日" (16px / 500)
│  │  └─ Text "曜日" (11px muted)
│  └─ StreakDisplay (right) ← 新規コンポーネント
│     ├─ Row (number + suffix)
│     │  ├─ Text "7" (18px / 600)
│     │  └─ Text "日連続" (10px muted)
│     ├─ Dots (last 7 days)
│     │  └─ Dot×7 (9px square、書いた日=黒、今日=黒+輪郭、無=#e8e8e8)
│     └─ Text "直近7日" (9px muted)
├─ CharCount (右寄せ、本文の上、margin-bottom 6)
│  └─ Text "残り N 字" (11px、警告色は既存ロジック)
├─ EntryInput (flex: 1)
│  └─ TextInput (22px / 1.7 / 改行禁止 / 140 字制限、border 無し)
└─ Footer (flex-row, justify-flex-end, padding-top 14, border-top)
   └─ SaveButton (PressableScale)
      └─ Text "保存" (13px / 500、padding 10/22、radius 6)
```

**主な変更:**
- `StreakBadge` (旧、橙色丸バッジ) → **`StreakDisplay`** 新規コンポーネント
- 本文 (TextInput) のフォントサイズ: 16 → **22**
- 本文の `border` を削除 (現行は四角い枠線、ミニマル化のため枠廃止、フォーカス時も枠なし)。トークンの `inputBorder` は EntryInput では参照しなくなる (将来の他用途に備えて token 自体は残す)
- 残り字数の位置: 本文の **下 → 上**
- 保存ボタン: 全幅 → **右下に控えめ配置** (padding 10/22)
- `StreakDisplay` の中の数字には既存パルスアニメーション (ストリーク増加時)

### 3.2 HistoryScreen (履歴)

```
┌─ タブ ──────────────────────────────────────┐
│  カレンダー       │       タイムライン       │
│      ──── (アクティブ: 短い下線)           │
└─────────────────────────────────────────────┘
```

#### 3.2.1 カレンダーモード

- `react-native-calendars` の theme prop 全面更新
- ドット: `primary (#111)`
- 今日: `surface (#fafafa)` 背景 + 太字
- 矢印・選択日: モノクロ
- 曜日色: 日曜 `#c08080`、土曜 `#80a0c0` (薄く)、平日 `#aaa`
- 月見出し: 16px / 500

#### 3.2.2 タイムラインモード ★大改修

- **カードを廃止**、シンプルなリストへ
- **並び: 下 = 最新** (チャット型)
- **初期スクロール: 最下端** に自動
- 上端に薄い fade を表示 (もっと過去がある示唆)

```
┌─ tl-row ─────────────────────────────────────┐
│  22  4月  │ 同僚と立ち話、会話で気持ちが…   │
├──────────┼──────────────────────────────────┤
│  23  4月  │ 新しいプロジェクトが動き出す予感│
├──────────┼──────────────────────────────────┤
│  ...                                          │
├──────────┼──────────────────────────────────┤
│  28  4月  │ 桜が散って、新緑の季節が始まった│ ← 初期表示はここが見える
└──────────┴──────────────────────────────────┘
```

- 各行: 左に `tl-day` (18px bold) + `tl-mon` (9px muted)、右に本文 (14px / 1.6)
- 区切り: 細い `divider` のみ
- カード背景 / 角丸 / shadow は**全て廃止**
- タップ可能領域は行全体 (既存通り EntryEditorModal を開く)

#### 3.2.3 React Native 実装の差分

```tsx
<FlatList
  inverted        // ← 追加: 視覚反転 + 初期スクロール最下端
  data={entries}  // DESC のまま (変更なし)
  keyExtractor={(item) => item.date}
  renderItem={({ item }) => <TimelineRow entry={item} onPress={openEditor} />}
  ListEmptyComponent={...}
/>
```

`EntryCard` を廃止し、新規 `TimelineRow` コンポーネントに置換。

### 3.3 SettingsScreen

レイアウトは現状維持、色とトークンを差し替えるのみ。

| 要素 | 変更 |
|---|---|
| テーマ選択行のチェックマーク | `primary` (旧 blue → 新 black) |
| エクスポートボタン背景 | `primary` (旧 blue → 新 black)、文字色 `primaryText` |
| セクションタイトル | 現状維持 (11px uppercase muted) |
| 行の divider | 新トークン `divider` を使用 |

### 3.4 EntryEditorModal (履歴からの編集)

レイアウト維持、色のみ更新。

| 要素 | 変更 |
|---|---|
| 保存ボタン | 背景 `primary` (黒)、文字 `primaryText` |
| 削除ボタン | 背景 `danger` (#c62828) のまま |
| 日付見出し | 18px → そのまま、色 `text` |
| 入力欄 | HomeScreen の `EntryInput` を共用 → 22px に拡大される (副作用) |

### 3.5 LockScreen

| 要素 | 変更 |
|---|---|
| タイトル「🔒 ロックされています」 | 24px → 18px に縮小、weight 500 |
| 認証ボタン | `primary` 黒、padding 12/32、radius 6 |
| エラーメッセージ | `error` 色そのまま |
| 全体の余白 | 中央寄せ、`xxxl` (48) を意識した広め |

### 3.6 Bottom Tab (RootNavigator)

| 要素 | 変更 |
|---|---|
| アクティブ tint | `primary` (新 black) |
| 非アクティブ tint | `textMuted` (#888) |
| Tab bar 背景 | `surface` |
| 上部 border | `divider` で薄く |
| アイコン | Ionicons (今日 / 履歴 / 設定) は維持 |
| ヘッダー | 各 Tab Screen の title はそのまま |

---

## 4. コンポーネント変更マップ

| 現在のコンポーネント | 変更内容 |
|---|---|
| `src/components/StreakBadge.tsx` | **削除** (用途廃止) |
| `src/components/StreakDisplay.tsx` | **新規作成** (数字 + ドット + ラベル、Home 専用) |
| `src/components/EntryInput.tsx` | 本文 22px に拡大、border 全廃、placeholder 色更新 |
| `src/components/EntryCard.tsx` | **削除** (用途廃止) |
| `src/components/TimelineRow.tsx` | **新規作成** (左日付 + 右本文のリスト行) |
| `src/components/PressableScale.tsx` | 変更なし |
| `src/screens/HomeScreen.tsx` | レイアウト再構成 (本文ヒーロー / カウンター位置 / 保存ボタン位置) |
| `src/screens/HistoryScreen.tsx` | FlatList に `inverted`、TimelineRow を使う、calendar theme 更新 |
| `src/screens/EntryEditorModal.tsx` | 色のみ |
| `src/screens/SettingsScreen.tsx` | 色のみ |
| `src/screens/LockScreen.tsx` | タイトルサイズ縮小、色更新 |
| `src/navigation/RootNavigator.tsx` | TabBar の tint 色更新 |
| `src/theme/colors.ts` | 値全面更新 (型は維持) |
| `src/theme/typography.ts` | **新規** |
| `src/theme/spacing.ts` | **新規** |
| `src/theme/radius.ts` | **新規** |

---

## 5. データフロー

データ層は**一切変更なし**。

`StreakDisplay` が必要とする「直近 7 日のドット (true/false × 7)」は `EntriesContext` から派生する derived state として算出する。実装パターン:

```tsx
// EntriesContext に追加 or HomeScreen 内で派生
const recordedDates = new Set(entries.map(e => e.date));
const last7 = Array.from({ length: 7 }, (_, i) => {
  const d = addDays(today(), -(6 - i));  // 6日前 → 今日
  return { date: d, recorded: recordedDates.has(d), isToday: d === today() };
});
```

`utils/date.addDays` は既存。`StreakDisplay` には既存の `streak` 数値と上記 `last7` を props で渡す。

---

## 6. エラーハンドリング

既存の方針を維持 (UI 物理ガード + Alert + console.error)。本デザイン刷新で新たなエラー導入はなし。

---

## 7. テスト戦略

### 7.1 既存テスト

| ファイル | 対応 |
|---|---|
| `EntryInput.test.tsx` | カウンター表示「残り N 字」のテキスト assertion は不変 (位置が上になるだけ)。テストはそのまま PASS する想定。動かなければ調整。 |
| `StreakBadge.test.tsx` | **削除** (コンポーネント廃止) |
| `StreakDisplay.test.tsx` | **新規** (TDD)。3 ケース: 0 日 / 1 日 / N 日連続 + ドット表示の正しさ |
| utils / repos のテスト | 影響なし |

### 7.2 手動 QA チェックリスト (今回追加分)

- [ ] Home 画面: 本文が 22px で表示され、編集中も大きく読める
- [ ] Home 画面: 残り字数が本文の上に表示される
- [ ] Home 画面: ストリーク表示で直近 7 日が黒/灰のドットで分かる、今日のドットに輪郭がある
- [ ] Home 画面: 保存ボタンが右下に控えめに配置される
- [ ] History カレンダー: blue が消えて完全モノクロになっている
- [ ] History タイムライン: 開いた瞬間に「今日」(最下端) が見える
- [ ] History タイムライン: 上スクロールで過去に遡れる
- [ ] History タイムライン: カードの枠/影が消えてリスト型になっている
- [ ] Settings: テーマ選択のチェックが黒、エクスポートボタンが黒
- [ ] EntryEditor: 保存ボタンが黒、削除ボタンは赤のまま
- [ ] LockScreen: タイトルが控えめ、認証ボタンが黒
- [ ] Tab bar: アクティブ色が黒
- [ ] ダークモード: 全画面で primary が明色に反転、青の名残がない
- [ ] ストリーク達成 (連続日数増加) でパルスアニメーションが起きる
- [ ] 文字数カウンター: 残り 20 字以下でオレンジ、10 字以下で赤太字

---

## 8. 移行のリスクと方針

### 8.1 ユーザー視点のリスク

- 既存ユーザーが「青いボタンが急に黒になった」「タイムラインのカードが消えた」「並び順が逆になった」と困惑する可能性
- → MVP リリース直後のリデザインなので大きな問題にはならない。リリースノートで明示すれば十分。

### 8.2 実装上のリスク

- `FlatList` の `inverted` は React Native の標準機能だが、`ListEmptyComponent` の表示位置や ScrollView の挙動が直感と異なる場合がある → 手動 QA で確認
- 本文 22px に拡大すると、長文 (140 字いっぱい) では入力欄の高さが必要になる。`flex: 1` の親要素で確保する設計にする
- `react-native-calendars` の theme prop は数十のキーがあり、新トークンを反映する際にレガシーな blue が残らないよう全キーを再点検する

---

## 9. スコープ外 (再確認)

- 機能の追加・削除はなし
- データモデルの変更はなし
- ナビゲーション構造の変更はなし
- アイコン、splash、app.json、bundleId 等のメタ情報はなし
- 写真・タグ・検索・複数エントリ・クラウド同期などの新機能はなし
