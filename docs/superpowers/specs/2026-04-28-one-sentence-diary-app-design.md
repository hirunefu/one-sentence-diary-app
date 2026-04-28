# 一文日記アプリ 設計仕様書

**作成日:** 2026-04-28
**作成者:** ブレインストーミング (Claude Code + ユーザー)
**ステータス:** 設計確定

---

## 1. 概要

iOS / Android で動く React Native 製の **一文日記アプリ** (個人用)。1日1件、1文 (140 文字以内、改行不可) の日記を書き、カレンダーまたはタイムラインで振り返る。リマインダー通知、生体認証ロック、データのエクスポート機能を備える。

### 1.1 ユーザー / スコープ

- **ターゲット:** 自分専用 (個人プロジェクト)
- **配布:** ストア公開なし、ローカル端末で利用
- **認証 / アカウント:** なし
- **クラウド同期:** なし (バックアップは手動エクスポートのみ)

### 1.2 コア要件

| 項目 | 内容 |
|---|---|
| プラットフォーム | iOS / Android 両対応 |
| 1日のエントリ数 | 1日1件のみ (編集可) |
| 文字数制限 | 140 Unicode コードポイント以内、改行不可 |
| メイン画面 | カレンダー ↔ タイムラインリスト 切替 |
| リマインダー | ユーザー指定時刻に毎日プッシュ通知 |
| プライバシー | 生体認証 (Face ID / Touch ID / 指紋) ロック、ON/OFF 切替可能 |
| バックアップ | 手動エクスポート (JSON ファイルをシェアシート経由で保存) |
| その他 | ストリーク表示 (連続記録日数、定義は §3.4) |
| タイムゾーン | 端末ローカル TZ 基準 |
| 過去エントリの編集 | 可能 |
| 過去エントリの削除 | 可能 |

---

## 2. アーキテクチャ

### 2.1 階層構造

```
┌─────────────────────────────────────────────────┐
│                 React Native (Expo)              │
│                                                  │
│  ┌──────────────┐   ┌──────────────────────┐   │
│  │  Screens     │   │   Contexts            │   │
│  │ (UI Layer)   │──▶│  (State Layer)        │   │
│  │              │   │  - EntriesContext     │   │
│  │ Calendar     │   │  - SettingsContext    │   │
│  │ Timeline     │   │  - AuthLockContext    │   │
│  │ EntryEditor  │   └──────┬───────────────┘   │
│  │ Settings     │          │                    │
│  └──────────────┘          ▼                    │
│                     ┌──────────────────┐        │
│                     │  Repository層    │        │
│                     │  (Data Access)   │        │
│                     │  - entriesRepo   │        │
│                     │  - settingsRepo  │        │
│                     └──────┬───────────┘        │
│                            │                    │
│              ┌─────────────┼────────────┐       │
│              ▼             ▼            ▼       │
│        ┌──────────┐  ┌──────────┐ ┌──────────┐ │
│        │SQLite    │  │AsyncStor │ │ Native    │ │
│        │(entries) │  │(settings)│ │ Modules   │ │
│        └──────────┘  └──────────┘ │ - Notif.  │ │
│                                   │ - LocalAuth│ │
│                                   │ - FileSys │ │
│                                   └──────────┘ │
└─────────────────────────────────────────────────┘
```

### 2.2 設計方針

1. **3 層構造 (UI / State / Data):** 各層の責務を明確に分け、テスト可能性を確保する
2. **Repository パターン:** SQLite / AsyncStorage / ネイティブモジュールへのアクセスを Repository に集約。UI / Context は Repository のインターフェイスのみを知る
3. **Context は最小単位で分割:** エントリ用、設定用、ロック状態用に分離 (1 つの巨大 Context は再レンダリング暴発の元)
4. **設定値は AsyncStorage:** スキーマ不要の少量 KV データはこちらが軽量
5. **エントリ本体は SQLite:** 件数が増えても集計クエリが高速

### 2.3 技術スタック

| 用途 | ライブラリ |
|---|---|
| フレームワーク | Expo (Managed Workflow) + TypeScript |
| ナビゲーション | react-navigation (Bottom Tabs + Modal) |
| カレンダー UI | react-native-calendars |
| ローカル DB | expo-sqlite |
| 設定永続化 | @react-native-async-storage/async-storage |
| 通知 | expo-notifications |
| 生体認証 | expo-local-authentication |
| ファイル / シェア | expo-file-system + expo-sharing |
| 状態管理 | React Context (個人用には十分、Zustand 等は YAGNI) |

---

## 3. データモデル

### 3.1 SQLite: `entries` テーブル

```sql
CREATE TABLE entries (
  date     TEXT PRIMARY KEY,       -- 'YYYY-MM-DD' (端末ローカル TZ 基準、1日1件保証)
  text     TEXT NOT NULL,          -- 一文 (最大 140 コードポイント、改行不可)
  created_at INTEGER NOT NULL,     -- UNIX time ms (初回作成)
  updated_at INTEGER NOT NULL      -- UNIX time ms (最終編集)
);

CREATE INDEX idx_entries_date_desc ON entries(date DESC);  -- タイムライン用
```

**設計根拠:**
- `date` を **PRIMARY KEY** にすることで「1日1件」をスキーマレベルで保証
- 端末ローカル TZ で日付を確定 (海外旅行中はその国の日付になる)
- `updated_at` は MVP では未使用だが、将来「最近編集」表示などで活用可能
- ストリーク計算は `SELECT date FROM entries ORDER BY date DESC` で取得し、JS で連続性を判定 (直近のみ走査するため軽量)

### 3.2 AsyncStorage: 設定 (KV)

| キー | 型 | デフォルト | 内容 |
|---|---|---|---|
| `settings.lockEnabled` | boolean | `false` | 生体認証ロック ON/OFF |
| `settings.reminderEnabled` | boolean | `false` | リマインダー通知 ON/OFF |
| `settings.reminderHour` | number (0-23) | `21` | リマインダー時刻 (時) |
| `settings.reminderMinute` | number (0-59) | `0` | リマインダー時刻 (分) |
| `settings.viewMode` | `'calendar' \| 'timeline'` | `'calendar'` | 最後に選んだ表示モード |

### 3.3 TypeScript 型定義

```ts
export type Entry = {
  date: string;        // 'YYYY-MM-DD'
  text: string;        // <= 140 コードポイント、改行なし
  createdAt: number;   // ms epoch
  updatedAt: number;   // ms epoch
};

export type Settings = {
  lockEnabled: boolean;
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  viewMode: 'calendar' | 'timeline';
};
```

### 3.4 ストリーク (連続記録日数) の定義

「今日まで連続して書いている日数」を表示する。今日が未記入の場合、**昨日までの連続日数を表示する** (今日書けば自然と +1 されて続く感覚)。日付は端末ローカル TZ 基準。

| 状態 | ストリーク表示 |
|---|---|
| 今日記入済み + 昨日記入済み + … N 日連続 | N 日 |
| 今日記入済みのみ (昨日は未記入) | 1 日 |
| 今日未記入 + 昨日記入済み + … M 日連続 | M 日 (昨日までの連続) |
| 今日も昨日も未記入 (一昨日以前は連続記入あり) | 0 日 |
| エントリ 0 件 | 0 日 |

**判定ロジック (擬似コード):**
```
sortedDates = SELECT date FROM entries ORDER BY date DESC
if sortedDates is empty: return 0

cursor = today
if sortedDates[0] != today AND sortedDates[0] != yesterday: return 0

// 連続している日付を数える
streak = 0
for d in sortedDates:
  if d == cursor:
    streak += 1
    cursor = cursor - 1 day
  else:
    break
return streak
```

### 3.5 エクスポート JSON のスキーマ

```json
{
  "version": 1,
  "exportedAt": "2026-04-28T12:34:56.789Z",
  "appVersion": "1.0.0",
  "entries": [
    {
      "date": "2026-04-28",
      "text": "今日は雨だった。",
      "createdAt": 1745846400000,
      "updatedAt": 1745846400000
    },
    {
      "date": "2026-04-27",
      "text": "コーヒーが美味しかった。",
      "createdAt": 1745760000000,
      "updatedAt": 1745760000000
    }
  ]
}
```

- `version` は将来のスキーマ変更に備える (将来「インポート」機能を作るときに参照)
- `entries` は **日付降順** で出力
- ファイル名は `diary_YYYY-MM-DD.json` (エクスポート実行日)

---

## 4. 画面とコンポーネント

### 4.1 ナビゲーション構成

```
RootNavigator
│
├─ LockScreen           ← 起動時 / バックグラウンド復帰時 (ロック ON の時のみ)
│
└─ MainTabs (Bottom Tab)
   ├─ HomeScreen        ← 「今日」を書く / 編集
   ├─ HistoryScreen     ← カレンダー / タイムライン (トグル切替)
   └─ SettingsScreen    ← リマインダー / ロック / エクスポート

   (Modal)
   └─ EntryEditorModal  ← HistoryScreen から過去エントリをタップで開く
```

### 4.2 各画面の責務

#### `HomeScreen` — 今日の一文を書く

- 上部: 今日の日付 + ストリーク表示 (例: 「🔥 7日連続」)
- 中央: テキスト入力欄 (140字、改行不可、残り文字数表示)
- 下部: 保存ボタン (空文字なら無効化)
- 既に今日のエントリがあれば読み込んで編集モード

#### `HistoryScreen` — 過去エントリの閲覧

- 上部: トグル `[カレンダー | タイムライン]` (選択は AsyncStorage に永続化)
- **Calendar モード:** `react-native-calendars` で月表示。書いた日にドット表示。タップで `EntryEditorModal` 起動
- **Timeline モード:** `FlatList` で日付降順にカード表示。タップで `EntryEditorModal` 起動

#### `EntryEditorModal` — 過去エントリの表示・編集・削除

- HomeScreen と同じ入力 UI を流用 (`EntryInput` コンポーネント)
- 削除ボタン (確認ダイアログ経由)

#### `SettingsScreen` — 設定

- 生体認証ロック ON/OFF (Switch)
- リマインダー ON/OFF (Switch) + 時刻ピッカー
- 「データをエクスポート」ボタン (JSON をシェアシート経由で出力)
- アプリ情報 (バージョン)

#### `LockScreen` — ロック解除

- 起動時 / バックグラウンド復帰時に `expo-local-authentication` で生体認証を要求
- 失敗時は再試行ボタン
- ロック OFF の場合はスキップ (RootNavigator 側で分岐)

### 4.3 共通コンポーネント

| コンポーネント | 責務 |
|---|---|
| `EntryInput` | 140 コードポイント制限・改行禁止の `TextInput` ラッパ。`onChangeText` で打鍵を弾く |
| `StreakBadge` | 連続日数を「🔥 N日連続」形式で表示 |
| `EntryCard` | Timeline 用のカード (日付 + 一文) |

### 4.4 ファイル構成

```
src/
├─ App.tsx
├─ navigation/
│   └─ RootNavigator.tsx
├─ screens/
│   ├─ HomeScreen.tsx
│   ├─ HistoryScreen.tsx
│   ├─ SettingsScreen.tsx
│   ├─ LockScreen.tsx
│   └─ EntryEditorModal.tsx
├─ components/
│   ├─ EntryInput.tsx
│   ├─ StreakBadge.tsx
│   └─ EntryCard.tsx
├─ contexts/
│   ├─ EntriesContext.tsx
│   ├─ SettingsContext.tsx
│   └─ AuthLockContext.tsx
├─ repositories/
│   ├─ entriesRepository.ts        ← SQLite アクセス
│   └─ settingsRepository.ts       ← AsyncStorage アクセス
├─ services/
│   ├─ notifications.ts            ← expo-notifications ラッパ
│   ├─ localAuth.ts                ← expo-local-authentication ラッパ
│   └─ exportService.ts            ← JSON エクスポート
├─ db/
│   ├─ database.ts                 ← SQLite 初期化、マイグレーション実行
│   └─ migrations.ts
├─ utils/
│   ├─ date.ts                     ← 'YYYY-MM-DD' 変換、TZ 考慮
│   ├─ text.ts                     ← countChars, truncate (Unicode コードポイント基準)
│   └─ streak.ts                   ← 連続日数計算
└─ types/
    └─ index.ts                    ← Entry, Settings 型
```

---

## 5. データフロー

### 5.1 起動シーケンス

```
App 起動
  │
  ▼
SettingsContext が AsyncStorage から設定読込
  │
  ▼
EntriesContext が SQLite を初期化 (マイグレーション含む)
  │
  ▼
AuthLockContext: lockEnabled かチェック
  │
  ├─ true  → LockScreen 表示 → 認証成功で MainTabs へ
  └─ false → 直接 MainTabs へ
```

### 5.2 「今日の一文を書く」フロー

```
HomeScreen マウント
  │
  ▼
EntriesContext.getByDate(today) を呼ぶ
  │
  ├─ 既存あり → text を入力欄に prefill (編集モード)
  └─ 既存なし → 空の入力欄 (新規モード)
  │
  ユーザーが入力 → 140 コードポイント / 改行を入力時点でブロック
  │
  ▼
保存ボタン押下
  │
  ▼
EntriesContext.upsert({date: today, text})
  │
  ▼
entriesRepository.upsert() → SQLite INSERT OR REPLACE
  │
  ▼
Context の entries キャッシュを更新 → 関連画面が再描画
  │
  ▼
ストリーク再計算 → StreakBadge 更新
```

### 5.3 「過去エントリを見る/編集する」フロー

```
HistoryScreen
  │
  ├─ Calendar モード: マウント時に getDatesInMonth(year, month) で
  │                   その月のエントリ日付一覧を取得 → ドット表示
  │
  └─ Timeline モード: getAll(limit, offset) で日付降順取得 → FlatList

  日付/カードをタップ
  │
  ▼
EntryEditorModal 起動 (date を渡す)
  │
  ▼
getByDate(date) で内容取得 → 入力欄に表示
  │
  ├─ 編集 → 保存 → upsert → Context 更新 → Modal 閉じる
  └─ 削除 → 確認ダイアログ → delete(date) → Context 更新 → Modal 閉じる
```

### 5.4 リマインダー通知のスケジュール

```
SettingsContext
  │
  reminderEnabled / reminderHour / reminderMinute が変化したら
  │
  ▼
notifications.rescheduleDailyReminder()
  │
  ├─ 既存の通知をキャンセル
  └─ enabled なら expo-notifications で daily trigger を再登録

(初回 ON 時)
  │
  ▼
expo-notifications.requestPermissionsAsync()
  │
  └─ 拒否されたら Settings の Switch を OFF に戻し、案内表示
```

### 5.5 エクスポートフロー

```
Settings の「データをエクスポート」タップ
  │
  ▼
exportService.export()
  │
  ├─ entriesRepository.getAll() で全件取得
  ├─ JSON 文字列に整形
  ├─ expo-file-system でキャッシュ領域に一時ファイル書き出し
  │   (例: diary_2026-04-28.json)
  └─ expo-sharing.shareAsync() でシェアシート起動
  │
  ▼
ユーザーが保存先を選択 (Files / iCloud Drive / メール等)
```

### 5.6 バックグラウンド復帰時のロック

```
AppState が 'background' → 'active' に変化
  │
  ▼
AuthLockContext: lockEnabled なら isLocked = true に戻す
  │
  ▼
LockScreen を表示 → 認証成功で解除
```

**方針:** バックグラウンド復帰時は **常に再ロック** (時間閾値なし、シンプル優先)

---

## 6. エラーハンドリング

### 6.1 入力バリデーション (UI 層で完結)

| 状況 | 対応 |
|---|---|
| 140 コードポイント超え | `EntryInput` の `onChangeText` で打鍵を弾く (`countChars(text) > 140` なら state 更新を拒否) |
| 改行入力 | 同関数内で `\n` を除去 |
| 空文字での保存 | 保存ボタンを `disabled` |

→ **エラーメッセージは出さない。**UI 側で物理的に入れさせない。

### 6.2 SQLite 関連

| 状況 | 対応 |
|---|---|
| DB 初期化失敗 (起動時) | フルスクリーンエラー表示「データベースを開けませんでした。アプリを再起動してください」+ 再試行ボタン (続行不可) |
| マイグレーション失敗 | 同上 |
| INSERT/UPDATE/DELETE 失敗 | `try/catch` で捕捉し、Toast/Alert で「保存に失敗しました」表示。Context のキャッシュは更新しない |
| `getByDate` などの SELECT 失敗 | エラーログ出力し、空結果として扱う (画面が真っ白にならないように) |

### 6.3 通知 (`expo-notifications`)

| 状況 | 対応 |
|---|---|
| 権限拒否 | Settings 画面で Switch を OFF に戻し、Alert で「設定アプリから通知を許可してください」案内 |
| スケジュール失敗 | エラーログ + Settings の Switch を OFF に戻す |

### 6.4 生体認証 (`expo-local-authentication`)

| 状況 | 対応 |
|---|---|
| 端末が生体認証非対応 | Settings でロック ON にしようとした時点で Alert「この端末では生体認証が利用できません」、Switch は OFF のまま |
| 認証キャンセル / 失敗 | LockScreen で「認証に失敗しました」表示 + 再試行ボタン。**バイパス手段なし** (個人用なので割り切る) |
| LockScreen 起動時に生体認証ハードウェア利用不可 | 「設定から生体認証を有効にしてください」表示 + アプリ設定への導線 |

### 6.5 エクスポート

| 状況 | 対応 |
|---|---|
| ファイル書き込み失敗 | Alert「エクスポートに失敗しました」 |
| エントリ 0 件 | ボタン押下時に Alert「エクスポートする日記がありません」(ボタン自体は disabled でも可) |
| シェアシートをユーザーがキャンセル | 何もしない (正常系) |

### 6.6 全般方針

- **クラッシュレポート系のサードパーティ (Sentry 等) は MVP では入れない** (個人用)
- **ユーザー向けエラーメッセージは日本語**、開発ログ (`console.error`) は英語可
- **catch なしの async は禁止** — Repository / Service 層は必ず Result を返すか throw を呼び出し側で受ける

---

## 7. テスト戦略

### 7.1 ツール

- **Jest** (Expo に標準同梱) — 単体テスト
- **`@testing-library/react-native`** — コンポーネントテスト
- **E2E (Detox 等) は導入しない** — 個人用 MVP には過剰

### 7.2 テスト対象とレベル

#### 7.2.1 ユニットテスト (純粋関数) — 厚めに書く

| ファイル | テスト内容 |
|---|---|
| `utils/date.ts` | `'YYYY-MM-DD'` 変換が端末ローカル TZ で正しいか、月初・月末・うるう年など |
| `utils/text.ts` | `countChars` がひらがな・漢字・絵文字を全て 1 字でカウントするか、`truncate` が境界で正しく切るか |
| `utils/streak.ts` | 連続日数計算: 0件 / 今日のみ / 連続 3 日 / 途中 1 日空き / 今日未記入 (昨日まで連続) など |

#### 7.2.2 Repository テスト (SQLite 統合) — メイン操作のみ

| ファイル | テスト内容 |
|---|---|
| `repositories/entriesRepository.ts` | `upsert` → `getByDate` で取得できる、`upsert` 上書きで内容更新、`delete` で消える、`getDatesInMonth` が範囲内のみ返す |

→ 各テスト前に `DROP & CREATE` でクリーンな状態に保つ

#### 7.2.3 Service テスト — モックで最小限

| ファイル | テスト内容 |
|---|---|
| `services/notifications.ts` | `expo-notifications` をモックし、reschedule で「キャンセル → 登録」が呼ばれるか |
| `services/exportService.ts` | エントリ JSON フォーマットが期待通りか (ファイル書き込みはモック) |

#### 7.2.4 コンポーネントテスト — クリティカルなものだけ

| ファイル | テスト内容 |
|---|---|
| `components/EntryInput.tsx` | 140字超えで入力が弾かれる、改行が除去される、残り文字数表示 |
| `components/StreakBadge.tsx` | 0日 / 1日 / N日連続の表示分岐 |

→ Screen 単位 (HomeScreen 等) のテストは Context のセットアップが煩雑なため **書かない**。手動確認で代替。

### 7.3 手動確認チェックリスト

実装フェーズの最後に通す:

- [ ] 今日の一文を書いて保存できる
- [ ] 同日に編集できる
- [ ] カレンダーモード / タイムラインモード の切替
- [ ] 過去エントリのタップで Modal 起動 → 編集 → 削除
- [ ] リマインダー設定 → 指定時刻に通知が来る
- [ ] 生体認証 ON → アプリ再起動でロック画面、認証成功で開く
- [ ] 生体認証 ON → バックグラウンド復帰で再ロック
- [ ] エクスポートでシェアシートが起動、JSON が正しい
- [ ] iOS / Android 両方の実機確認

### 7.4 カバレッジの考え方

- **純粋ロジック (utils): 80%+ 目標** (壊れると気付きにくい)
- **Repository: 主要パスのみ** (SQLite の挙動は信頼してよい)
- **UI: 重要コンポーネントのみ** (Screen テストは書かず手動確認で代替)

### 7.5 TDD 適用方針

- **utils 系: 完全 TDD** (テスト先行)
- **Repository: TDD 推奨** (SQLite クエリは思った通りに動かないことがある)
- **Service / Component: テスト後付け可** (UI 試行錯誤が多い)

---

## 8. スコープ外 (YAGNI)

明示的に **作らない** もの:

- ユーザー認証 / アカウント
- クラウド同期 (iCloud / Firebase 等)
- 自動バックアップ
- ムード / 気分アイコン
- タグ / カテゴリ
- 写真や添付ファイル
- 検索機能
- 複数デバイス対応
- ダークモード切替 (端末設定に追従するのは OK だが、独自の切替 UI は不要)
- E2E テスト
- クラッシュレポート (Sentry 等)
- アナリティクス
