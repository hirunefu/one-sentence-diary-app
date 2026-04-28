# 一文日記アプリ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** React Native (Expo) で個人用の「1日1件・140 文字以内」の一文日記アプリを iOS / Android 両プラットフォーム向けに構築する。

**Architecture:** 3 層構造 (UI / State / Data)。Repository パターンで SQLite と AsyncStorage へのアクセスを抽象化、Context は責務ごとに 3 分割 (Entries / Settings / AuthLock)、Service 層で expo-notifications / expo-local-authentication / expo-file-system をラップ。

**Tech Stack:** Expo SDK (Managed) + TypeScript / React Navigation / expo-sqlite / @react-native-async-storage/async-storage / expo-notifications / expo-local-authentication / expo-file-system + expo-sharing / react-native-calendars / Jest + jest-expo + @testing-library/react-native / better-sqlite3 (テスト用)

---

## 仕様書

`docs/superpowers/specs/2026-04-28-one-sentence-diary-app-design.md` を必ず参照すること。

---

## ファイル構成 (作成・変更するファイル)

```
one-sentence-diary-app/
├─ app.json                         (modify: アプリ名、bundle ID、permissions)
├─ App.tsx                          (modify: Provider 階層と Navigator)
├─ jest.config.js                   (create: jest-expo preset)
├─ jest.setup.ts                    (create: globals / mocks)
├─ tsconfig.json                    (modify: paths / strict)
├─ package.json                     (modify: scripts / deps)
├─ src/
│   ├─ navigation/
│   │   └─ RootNavigator.tsx
│   ├─ screens/
│   │   ├─ HomeScreen.tsx
│   │   ├─ HistoryScreen.tsx
│   │   ├─ SettingsScreen.tsx
│   │   ├─ LockScreen.tsx
│   │   └─ EntryEditorModal.tsx
│   ├─ components/
│   │   ├─ EntryInput.tsx
│   │   ├─ EntryInput.test.tsx
│   │   ├─ StreakBadge.tsx
│   │   ├─ StreakBadge.test.tsx
│   │   └─ EntryCard.tsx
│   ├─ contexts/
│   │   ├─ EntriesContext.tsx
│   │   ├─ SettingsContext.tsx
│   │   └─ AuthLockContext.tsx
│   ├─ repositories/
│   │   ├─ entriesRepository.ts
│   │   ├─ entriesRepository.test.ts
│   │   ├─ settingsRepository.ts
│   │   └─ settingsRepository.test.ts
│   ├─ services/
│   │   ├─ notifications.ts
│   │   ├─ notifications.test.ts
│   │   ├─ localAuth.ts
│   │   ├─ exportService.ts
│   │   └─ exportService.test.ts
│   ├─ db/
│   │   ├─ database.ts              (DiaryDatabase インターフェイス + expo-sqlite 実装)
│   │   ├─ migrations.ts
│   │   └─ testDatabase.ts          (better-sqlite3 を使ったテスト用実装)
│   ├─ utils/
│   │   ├─ date.ts
│   │   ├─ date.test.ts
│   │   ├─ text.ts
│   │   ├─ text.test.ts
│   │   ├─ streak.ts
│   │   └─ streak.test.ts
│   └─ types/
│       └─ index.ts
```

---

## 規約

### コミット
- VCS は **jj (jujutsu)** を使う。`git commit` ではなく `jj commit -m "..."` (jj は自動でファイルをトラックするので `jj add` 不要)
- コミットメッセージは **日本語**
- タスクの最後の Step ごとに 1 コミット

### コード
- 識別子・関数名・文字列リテラルは英語
- コメントは原則書かない (仕様書の `WHY` を残す必要があるときのみ日本語で 1 行)
- TypeScript strict mode

### テスト
- ファイル命名: `xxx.test.ts(x)` (同階層に配置)
- TDD 適用: utils / repositories / `EntryInput` / `StreakBadge`
- TDD なしで OK: services (テストはあとで書く) / contexts / screens (テスト書かない、手動QAで代替)

### コマンド (Windows / bash)
- ディレクトリ作成: `mkdir -p path/to/dir`
- パス区切り: jj/Node コマンドはスラッシュ `/` 推奨

---

## Task 1: プロジェクト初期化と最小起動

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `App.tsx`, `babel.config.js`, `index.ts` ほか Expo の生成物
- Create: `.gitignore` 拡張 (Expo 用エントリ追加)

- [ ] **Step 1: Expo TypeScript テンプレートで初期化**

```bash
cd C:/Users/lu/work && npx create-expo-app@latest one-sentence-diary-app --template blank-typescript --yes
```

注: ディレクトリは既に存在し、設計書 (`docs/...`) と `.gitignore` がある。`create-expo-app` はディレクトリが存在しても上書きせず追加する仕様だが、もし「ディレクトリが空ではない」と拒否される場合は次の代替手順を取る:

```bash
cd C:/Users/lu/work && npx create-expo-app@latest _diary-tmp --template blank-typescript --yes
cp -r _diary-tmp/* _diary-tmp/.[!.]* one-sentence-diary-app/ 2>/dev/null || true
rm -rf _diary-tmp
```

- [ ] **Step 2: `.gitignore` を拡張**

既存の `.gitignore` の末尾に追記する。最終的な `.gitignore` の中身:

```gitignore
.claude/settings.local.json

# dependencies
node_modules/

# Expo
.expo/
.expo-shared/
dist/
web-build/

# Native
ios/
android/
*.orig.*

# Metro
.metro-health-check*

# debug
npm-debug.*
yarn-debug.*
yarn-error.*

# macOS
.DS_Store

# IDE
.idea/
.vscode/

# Test coverage
coverage/
```

- [ ] **Step 3: 必要な依存をインストール**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx expo install expo-sqlite expo-notifications expo-local-authentication expo-file-system expo-sharing @react-native-async-storage/async-storage @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack react-native-screens react-native-safe-area-context react-native-calendars
```

- [ ] **Step 4: テスト関連の dev 依存をインストール**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm install --save-dev jest jest-expo @testing-library/react-native @types/jest better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 5: `package.json` に test スクリプトを追加**

`package.json` の `scripts` セクションを以下に変更:

```json
"scripts": {
  "start": "expo start",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "web": "expo start --web",
  "test": "jest"
},
```

- [ ] **Step 6: `jest.config.js` を作成**

`jest.config.js`:

```js
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))'
  ],
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
};
```

- [ ] **Step 7: `tsconfig.json` を strict 化**

`tsconfig.json` を以下に置き換える:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
```

- [ ] **Step 8: `app.json` のメタ情報を更新**

`app.json` の `expo` セクションを以下に更新 (他のキーは保持):

```json
{
  "expo": {
    "name": "一文日記",
    "slug": "one-sentence-diary",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.hirunefu.onesentencediary",
      "infoPlist": {
        "NSFaceIDUsageDescription": "アプリのロックを解除するために使用します"
      }
    },
    "android": {
      "package": "com.hirunefu.onesentencediary",
      "adaptiveIcon": {
        "backgroundColor": "#ffffff"
      }
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "color": "#ffffff"
        }
      ],
      [
        "expo-local-authentication",
        {
          "faceIDPermission": "アプリのロックを解除するために使用します"
        }
      ]
    ]
  }
}
```

- [ ] **Step 9: `src/` 構造を作成**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && mkdir -p src/navigation src/screens src/components src/contexts src/repositories src/services src/db src/utils src/types
```

- [ ] **Step 10: 起動確認 (型チェックのみ)**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 11: テストランナーが動くことを確認 (空 pass)**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- --passWithNoTests
```

期待: `No tests found, exiting with code 0` (with --passWithNoTests)

- [ ] **Step 12: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "プロジェクトを初期化し、依存とテスト基盤をセットアップ"
```

---

## Task 2: utils/text.ts (TDD)

**Files:**
- Create: `src/utils/text.ts`
- Test: `src/utils/text.test.ts`

役割: `countChars` (Unicode コードポイント単位の文字数カウント)、`truncate` (140 字で切り詰め)、`stripNewlines` (改行除去)。

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/text.test.ts`:

```ts
import { countChars, truncate, stripNewlines } from './text';

describe('countChars', () => {
  test('returns 0 for empty string', () => {
    expect(countChars('')).toBe(0);
  });

  test('counts ASCII characters as 1 each', () => {
    expect(countChars('hello')).toBe(5);
  });

  test('counts hiragana as 1 each', () => {
    expect(countChars('こんにちは')).toBe(5);
  });

  test('counts kanji (BMP) as 1 each', () => {
    expect(countChars('日本語')).toBe(3);
  });

  test('counts emoji (surrogate pair) as 1', () => {
    expect(countChars('😀')).toBe(1);
  });

  test('counts mixed text correctly', () => {
    expect(countChars('Hi😀こん')).toBe(5);
  });
});

describe('truncate', () => {
  test('returns original if within limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  test('truncates ASCII at exactly the limit', () => {
    expect(truncate('hello world', 5)).toBe('hello');
  });

  test('truncates emoji safely (no broken surrogate)', () => {
    expect(truncate('a😀b😀c', 3)).toBe('a😀b');
  });

  test('returns empty if max is 0', () => {
    expect(truncate('hello', 0)).toBe('');
  });
});

describe('stripNewlines', () => {
  test('returns unchanged if no newlines', () => {
    expect(stripNewlines('hello world')).toBe('hello world');
  });

  test('removes \\n', () => {
    expect(stripNewlines('hello\nworld')).toBe('helloworld');
  });

  test('removes \\r\\n and \\r', () => {
    expect(stripNewlines('a\r\nb\rc')).toBe('abc');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/utils/text.test.ts
```

期待: モジュール解決エラー (`Cannot find module './text'`)

- [ ] **Step 3: 最小実装を書く**

`src/utils/text.ts`:

```ts
export function countChars(text: string): number {
  let count = 0;
  for (const _ of text) {
    count++;
  }
  return count;
}

export function truncate(text: string, max: number): string {
  if (max <= 0) return '';
  let count = 0;
  let result = '';
  for (const ch of text) {
    if (count >= max) break;
    result += ch;
    count++;
  }
  return result;
}

export function stripNewlines(text: string): string {
  return text.replace(/[\r\n]/g, '');
}
```

- [ ] **Step 4: テストがパスすることを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/utils/text.test.ts
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "utils/text.ts: 文字数カウント・切り詰め・改行除去ユーティリティを追加"
```

---

## Task 3: utils/date.ts (TDD)

**Files:**
- Create: `src/utils/date.ts`
- Test: `src/utils/date.test.ts`

役割: `Date` <-> `'YYYY-MM-DD'` 変換 (端末ローカル TZ)、今日 / 昨日 の取得、日付加算。

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/date.test.ts`:

```ts
import { toDateString, fromDateString, today, yesterday, addDays } from './date';

describe('toDateString', () => {
  test('formats local date as YYYY-MM-DD', () => {
    const d = new Date(2026, 3, 28, 15, 30); // 2026-04-28 (month is 0-indexed)
    expect(toDateString(d)).toBe('2026-04-28');
  });

  test('pads single-digit month and day', () => {
    const d = new Date(2026, 0, 5);
    expect(toDateString(d)).toBe('2026-01-05');
  });

  test('handles year boundary', () => {
    const d = new Date(2025, 11, 31);
    expect(toDateString(d)).toBe('2025-12-31');
  });
});

describe('fromDateString', () => {
  test('parses YYYY-MM-DD into a Date at local midnight', () => {
    const d = fromDateString('2026-04-28');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(28);
    expect(d.getHours()).toBe(0);
  });
});

describe('today', () => {
  test('returns todays date string in local TZ', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(today()).toBe(expected);
  });
});

describe('yesterday', () => {
  test('returns yesterdays date string', () => {
    const now = new Date();
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const expected = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    expect(yesterday()).toBe(expected);
  });
});

describe('addDays', () => {
  test('adds positive days', () => {
    expect(addDays('2026-04-28', 1)).toBe('2026-04-29');
  });

  test('subtracts negative days', () => {
    expect(addDays('2026-04-28', -1)).toBe('2026-04-27');
  });

  test('crosses month boundary', () => {
    expect(addDays('2026-04-30', 1)).toBe('2026-05-01');
  });

  test('crosses year boundary', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
  });

  test('handles leap year (2028 is leap)', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  test('handles non-leap year (2026)', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/utils/date.test.ts
```

期待: モジュール解決エラー

- [ ] **Step 3: 最小実装を書く**

`src/utils/date.ts`:

```ts
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromDateString(s: string): Date {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function today(): string {
  return toDateString(new Date());
}

export function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateString(d);
}

export function addDays(dateStr: string, days: number): string {
  const d = fromDateString(dateStr);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}
```

- [ ] **Step 4: テストがパスすることを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/utils/date.test.ts
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "utils/date.ts: 日付文字列変換と加算ユーティリティを追加"
```

---

## Task 4: utils/streak.ts (TDD)

**Files:**
- Create: `src/utils/streak.ts`
- Test: `src/utils/streak.test.ts`

役割: 日付降順の文字列配列から、仕様 §3.4 のロジックに従ってストリーク (連続日数) を計算する。

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/streak.test.ts`:

```ts
import { calculateStreak } from './streak';

describe('calculateStreak', () => {
  test('returns 0 for empty list', () => {
    expect(calculateStreak([], '2026-04-28')).toBe(0);
  });

  test('returns 1 if only today is recorded', () => {
    expect(calculateStreak(['2026-04-28'], '2026-04-28')).toBe(1);
  });

  test('returns N for N consecutive days ending today', () => {
    expect(calculateStreak(
      ['2026-04-28', '2026-04-27', '2026-04-26'],
      '2026-04-28'
    )).toBe(3);
  });

  test('returns previous streak when today is unrecorded but yesterday is', () => {
    expect(calculateStreak(
      ['2026-04-27', '2026-04-26', '2026-04-25'],
      '2026-04-28'
    )).toBe(3);
  });

  test('returns 0 when today and yesterday both unrecorded', () => {
    expect(calculateStreak(
      ['2026-04-26', '2026-04-25'],
      '2026-04-28'
    )).toBe(0);
  });

  test('breaks at first gap', () => {
    expect(calculateStreak(
      ['2026-04-28', '2026-04-27', '2026-04-25'],
      '2026-04-28'
    )).toBe(2);
  });

  test('crosses month boundary', () => {
    expect(calculateStreak(
      ['2026-05-01', '2026-04-30', '2026-04-29'],
      '2026-05-01'
    )).toBe(3);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/utils/streak.test.ts
```

期待: モジュール解決エラー

- [ ] **Step 3: 最小実装を書く**

`src/utils/streak.ts`:

```ts
import { addDays } from './date';

export function calculateStreak(sortedDescDates: string[], todayStr: string): number {
  if (sortedDescDates.length === 0) return 0;

  const yesterdayStr = addDays(todayStr, -1);
  const first = sortedDescDates[0]!;

  let cursor: string;
  if (first === todayStr) {
    cursor = todayStr;
  } else if (first === yesterdayStr) {
    cursor = yesterdayStr;
  } else {
    return 0;
  }

  let streak = 0;
  for (const d of sortedDescDates) {
    if (d === cursor) {
      streak++;
      cursor = addDays(cursor, -1);
    } else if (d < cursor) {
      break;
    }
  }
  return streak;
}
```

- [ ] **Step 4: テストがパスすることを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/utils/streak.test.ts
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "utils/streak.ts: 連続記録日数の計算ロジックを追加"
```

---

## Task 5: 型定義とデータベース基盤

**Files:**
- Create: `src/types/index.ts`
- Create: `src/db/database.ts`
- Create: `src/db/migrations.ts`
- Create: `src/db/testDatabase.ts`

役割: `Entry`/`Settings` 型、`DiaryDatabase` インターフェイス、expo-sqlite 実装、better-sqlite3 ベースのテスト用実装、マイグレーション SQL。

- [ ] **Step 1: 型定義を作成**

`src/types/index.ts`:

```ts
export type Entry = {
  date: string;
  text: string;
  createdAt: number;
  updatedAt: number;
};

export type Settings = {
  lockEnabled: boolean;
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  viewMode: 'calendar' | 'timeline';
};

export const DEFAULT_SETTINGS: Settings = {
  lockEnabled: false,
  reminderEnabled: false,
  reminderHour: 21,
  reminderMinute: 0,
  viewMode: 'calendar',
};

export const MAX_TEXT_LENGTH = 140;
```

- [ ] **Step 2: マイグレーション SQL を作成**

`src/db/migrations.ts`:

```ts
export const MIGRATIONS: ReadonlyArray<string> = [
  `CREATE TABLE IF NOT EXISTS entries (
    date TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_entries_date_desc ON entries(date DESC);`,
];

export async function runMigrations(
  exec: (sql: string) => Promise<void>
): Promise<void> {
  for (const sql of MIGRATIONS) {
    await exec(sql);
  }
}
```

- [ ] **Step 3: `DiaryDatabase` インターフェイスと expo-sqlite 実装を作成**

`src/db/database.ts`:

```ts
import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';

export interface DiaryDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    params?: ReadonlyArray<string | number | null>
  ): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(
    sql: string,
    params?: ReadonlyArray<string | number | null>
  ): Promise<T[]>;
  getFirstAsync<T>(
    sql: string,
    params?: ReadonlyArray<string | number | null>
  ): Promise<T | null>;
  closeAsync(): Promise<void>;
}

export async function openDatabase(): Promise<DiaryDatabase> {
  const db = await SQLite.openDatabaseAsync('diary.db');
  await runMigrations((sql) => db.execAsync(sql));
  return {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: (sql, params) => db.runAsync(sql, ...(params ?? [])),
    getAllAsync: <T>(sql: string, params?: ReadonlyArray<string | number | null>) =>
      db.getAllAsync<T>(sql, ...(params ?? [])),
    getFirstAsync: <T>(sql: string, params?: ReadonlyArray<string | number | null>) =>
      db.getFirstAsync<T>(sql, ...(params ?? [])),
    closeAsync: () => db.closeAsync(),
  };
}
```

- [ ] **Step 4: better-sqlite3 ベースのテスト用実装を作成**

`src/db/testDatabase.ts`:

```ts
import Database from 'better-sqlite3';
import type { DiaryDatabase } from './database';
import { runMigrations } from './migrations';

export async function openTestDatabase(): Promise<DiaryDatabase> {
  const db = new Database(':memory:');

  const wrapped: DiaryDatabase = {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, params) {
      const stmt = db.prepare(sql);
      const result = stmt.run(...(params ?? []));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: result.changes,
      };
    },
    async getAllAsync<T>(sql: string, params?: ReadonlyArray<string | number | null>) {
      return db.prepare(sql).all(...(params ?? [])) as T[];
    },
    async getFirstAsync<T>(sql: string, params?: ReadonlyArray<string | number | null>) {
      const row = db.prepare(sql).get(...(params ?? []));
      return (row ?? null) as T | null;
    },
    async closeAsync() {
      db.close();
    },
  };

  await runMigrations((sql) => wrapped.execAsync(sql));
  return wrapped;
}
```

- [ ] **Step 5: 型チェックが通ることを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 6: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "型定義とDB基盤(DiaryDatabaseインターフェイス・マイグレーション・テスト用実装)を追加"
```

---

## Task 6: entriesRepository (TDD)

**Files:**
- Create: `src/repositories/entriesRepository.ts`
- Test: `src/repositories/entriesRepository.test.ts`

役割: `entries` テーブルへの CRUD と日付集計クエリ。

- [ ] **Step 1: 失敗するテストを書く**

`src/repositories/entriesRepository.test.ts`:

```ts
import { openTestDatabase } from '../db/testDatabase';
import type { DiaryDatabase } from '../db/database';
import {
  upsertEntry,
  getEntryByDate,
  deleteEntry,
  getAllEntriesDesc,
  getDatesInMonth,
  getAllDatesDesc,
} from './entriesRepository';

describe('entriesRepository', () => {
  let db: DiaryDatabase;

  beforeEach(async () => {
    db = await openTestDatabase();
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  test('upsert then getByDate returns the entry', async () => {
    await upsertEntry(db, { date: '2026-04-28', text: 'hello', now: 1000 });
    const e = await getEntryByDate(db, '2026-04-28');
    expect(e).toEqual({
      date: '2026-04-28',
      text: 'hello',
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  test('getByDate returns null when no entry', async () => {
    const e = await getEntryByDate(db, '2026-04-28');
    expect(e).toBeNull();
  });

  test('upsert overwrites text and updates updatedAt but keeps createdAt', async () => {
    await upsertEntry(db, { date: '2026-04-28', text: 'first', now: 1000 });
    await upsertEntry(db, { date: '2026-04-28', text: 'second', now: 2000 });
    const e = await getEntryByDate(db, '2026-04-28');
    expect(e).toEqual({
      date: '2026-04-28',
      text: 'second',
      createdAt: 1000,
      updatedAt: 2000,
    });
  });

  test('deleteEntry removes the entry', async () => {
    await upsertEntry(db, { date: '2026-04-28', text: 'hello', now: 1000 });
    await deleteEntry(db, '2026-04-28');
    expect(await getEntryByDate(db, '2026-04-28')).toBeNull();
  });

  test('getAllEntriesDesc returns entries newest first', async () => {
    await upsertEntry(db, { date: '2026-04-26', text: 'a', now: 1000 });
    await upsertEntry(db, { date: '2026-04-28', text: 'c', now: 1000 });
    await upsertEntry(db, { date: '2026-04-27', text: 'b', now: 1000 });
    const list = await getAllEntriesDesc(db);
    expect(list.map((e) => e.date)).toEqual(['2026-04-28', '2026-04-27', '2026-04-26']);
  });

  test('getDatesInMonth returns only dates within the month', async () => {
    await upsertEntry(db, { date: '2026-03-31', text: 'a', now: 1000 });
    await upsertEntry(db, { date: '2026-04-01', text: 'b', now: 1000 });
    await upsertEntry(db, { date: '2026-04-15', text: 'c', now: 1000 });
    await upsertEntry(db, { date: '2026-04-30', text: 'd', now: 1000 });
    await upsertEntry(db, { date: '2026-05-01', text: 'e', now: 1000 });
    const dates = await getDatesInMonth(db, 2026, 4);
    expect(dates.sort()).toEqual(['2026-04-01', '2026-04-15', '2026-04-30']);
  });

  test('getAllDatesDesc returns date strings newest first', async () => {
    await upsertEntry(db, { date: '2026-04-26', text: 'a', now: 1000 });
    await upsertEntry(db, { date: '2026-04-28', text: 'c', now: 1000 });
    const dates = await getAllDatesDesc(db);
    expect(dates).toEqual(['2026-04-28', '2026-04-26']);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/repositories/entriesRepository.test.ts
```

期待: モジュール解決エラー

- [ ] **Step 3: 実装を書く**

`src/repositories/entriesRepository.ts`:

```ts
import type { DiaryDatabase } from '../db/database';
import type { Entry } from '../types';

type EntryRow = {
  date: string;
  text: string;
  created_at: number;
  updated_at: number;
};

function rowToEntry(row: EntryRow): Entry {
  return {
    date: row.date,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertEntry(
  db: DiaryDatabase,
  args: { date: string; text: string; now: number }
): Promise<void> {
  await db.runAsync(
    `INSERT INTO entries (date, text, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       text = excluded.text,
       updated_at = excluded.updated_at`,
    [args.date, args.text, args.now, args.now]
  );
}

export async function getEntryByDate(
  db: DiaryDatabase,
  date: string
): Promise<Entry | null> {
  const row = await db.getFirstAsync<EntryRow>(
    `SELECT date, text, created_at, updated_at FROM entries WHERE date = ?`,
    [date]
  );
  return row ? rowToEntry(row) : null;
}

export async function deleteEntry(
  db: DiaryDatabase,
  date: string
): Promise<void> {
  await db.runAsync(`DELETE FROM entries WHERE date = ?`, [date]);
}

export async function getAllEntriesDesc(db: DiaryDatabase): Promise<Entry[]> {
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT date, text, created_at, updated_at FROM entries ORDER BY date DESC`
  );
  return rows.map(rowToEntry);
}

export async function getDatesInMonth(
  db: DiaryDatabase,
  year: number,
  month: number
): Promise<string[]> {
  const mm = String(month).padStart(2, '0');
  const start = `${year}-${mm}-01`;
  const end = `${year}-${mm}-31`;
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT date FROM entries WHERE date >= ? AND date <= ?`,
    [start, end]
  );
  return rows.map((r) => r.date);
}

export async function getAllDatesDesc(db: DiaryDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT date FROM entries ORDER BY date DESC`
  );
  return rows.map((r) => r.date);
}
```

- [ ] **Step 4: テストがパスすることを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/repositories/entriesRepository.test.ts
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "entriesRepository: SQLiteへのCRUDと日付集計クエリを追加"
```

---

## Task 7: settingsRepository

**Files:**
- Create: `src/repositories/settingsRepository.ts`
- Test: `src/repositories/settingsRepository.test.ts`

役割: AsyncStorage 経由で `Settings` を読み書き。各キーは `settings.<name>` 形式。

- [ ] **Step 1: テストを書く (AsyncStorage モックを使用)**

`src/repositories/settingsRepository.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadSettings, saveSettings } from './settingsRepository';
import { DEFAULT_SETTINGS } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('settingsRepository', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('loadSettings returns defaults when storage is empty', async () => {
    const s = await loadSettings();
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  test('saveSettings then loadSettings round-trips all fields', async () => {
    const next = {
      lockEnabled: true,
      reminderEnabled: true,
      reminderHour: 8,
      reminderMinute: 30,
      viewMode: 'timeline' as const,
    };
    await saveSettings(next);
    expect(await loadSettings()).toEqual(next);
  });

  test('partial pre-existing data is filled with defaults for missing keys', async () => {
    await AsyncStorage.setItem('settings.reminderHour', '7');
    const s = await loadSettings();
    expect(s.reminderHour).toBe(7);
    expect(s.lockEnabled).toBe(false);
    expect(s.viewMode).toBe('calendar');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/repositories/settingsRepository.test.ts
```

期待: モジュール解決エラー

- [ ] **Step 3: 実装を書く**

`src/repositories/settingsRepository.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

const KEYS = {
  lockEnabled: 'settings.lockEnabled',
  reminderEnabled: 'settings.reminderEnabled',
  reminderHour: 'settings.reminderHour',
  reminderMinute: 'settings.reminderMinute',
  viewMode: 'settings.viewMode',
} as const;

function parseBool(v: string | null, def: boolean): boolean {
  if (v === null) return def;
  return v === 'true';
}

function parseNumber(v: string | null, def: number): number {
  if (v === null) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function parseViewMode(
  v: string | null,
  def: 'calendar' | 'timeline'
): 'calendar' | 'timeline' {
  if (v === 'calendar' || v === 'timeline') return v;
  return def;
}

export async function loadSettings(): Promise<Settings> {
  const [lock, rem, hour, minute, view] = await Promise.all([
    AsyncStorage.getItem(KEYS.lockEnabled),
    AsyncStorage.getItem(KEYS.reminderEnabled),
    AsyncStorage.getItem(KEYS.reminderHour),
    AsyncStorage.getItem(KEYS.reminderMinute),
    AsyncStorage.getItem(KEYS.viewMode),
  ]);
  return {
    lockEnabled: parseBool(lock, DEFAULT_SETTINGS.lockEnabled),
    reminderEnabled: parseBool(rem, DEFAULT_SETTINGS.reminderEnabled),
    reminderHour: parseNumber(hour, DEFAULT_SETTINGS.reminderHour),
    reminderMinute: parseNumber(minute, DEFAULT_SETTINGS.reminderMinute),
    viewMode: parseViewMode(view, DEFAULT_SETTINGS.viewMode),
  };
}

export async function saveSettings(s: Settings): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.lockEnabled, String(s.lockEnabled)),
    AsyncStorage.setItem(KEYS.reminderEnabled, String(s.reminderEnabled)),
    AsyncStorage.setItem(KEYS.reminderHour, String(s.reminderHour)),
    AsyncStorage.setItem(KEYS.reminderMinute, String(s.reminderMinute)),
    AsyncStorage.setItem(KEYS.viewMode, s.viewMode),
  ]);
}
```

- [ ] **Step 4: テストがパスすることを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/repositories/settingsRepository.test.ts
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "settingsRepository: AsyncStorageベースの設定読み書きを追加"
```

---

## Task 8: notifications service

**Files:**
- Create: `src/services/notifications.ts`
- Test: `src/services/notifications.test.ts`

役割: `requestPermission()`、`rescheduleDailyReminder(hour, minute)`、`cancelAllReminders()` を expo-notifications でラップ。

- [ ] **Step 1: テストを書く (expo-notifications をモック)**

`src/services/notifications.test.ts`:

```ts
import {
  rescheduleDailyReminder,
  cancelAllReminders,
  requestNotificationPermission,
  REMINDER_NOTIFICATION_ID,
} from './notifications';

jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('scheduled-id'),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));

import * as Notifications from 'expo-notifications';

describe('notifications service', () => {
  beforeEach(() => {
    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockClear();
    (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();
    (Notifications.cancelAllScheduledNotificationsAsync as jest.Mock).mockClear();
    (Notifications.requestPermissionsAsync as jest.Mock).mockClear();
  });

  test('rescheduleDailyReminder cancels existing then schedules new', async () => {
    await rescheduleDailyReminder(21, 0);

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      REMINDER_NOTIFICATION_ID
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: REMINDER_NOTIFICATION_ID,
        trigger: expect.objectContaining({ hour: 21, minute: 0 }),
      })
    );
  });

  test('cancelAllReminders cancels by ID', async () => {
    await cancelAllReminders();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      REMINDER_NOTIFICATION_ID
    );
  });

  test('requestNotificationPermission returns true if granted', async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });
    expect(await requestNotificationPermission()).toBe(true);
  });

  test('requestNotificationPermission returns false if denied', async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });
    expect(await requestNotificationPermission()).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/services/notifications.test.ts
```

期待: モジュール解決エラー

- [ ] **Step 3: 実装を書く**

`src/services/notifications.ts`:

```ts
import * as Notifications from 'expo-notifications';

export const REMINDER_NOTIFICATION_ID = 'daily-reminder';

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_NOTIFICATION_ID);
}

export async function rescheduleDailyReminder(
  hour: number,
  minute: number
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_NOTIFICATION_ID);
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_NOTIFICATION_ID,
    content: {
      title: '一文日記',
      body: '今日の一文を書きましょう',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}
```

- [ ] **Step 4: テストがパスすることを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/services/notifications.test.ts
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "services/notifications: expo-notificationsのラッパを追加"
```

---

## Task 9: localAuth service

**Files:**
- Create: `src/services/localAuth.ts`

役割: `expo-local-authentication` のラッパ。`isAvailable()` と `authenticate()` の 2 関数。テストはモック手間に対して価値が低いので **手動 QA で代替**。

- [ ] **Step 1: 実装を書く**

`src/services/localAuth.ts`:

```ts
import * as LocalAuthentication from 'expo-local-authentication';

export async function isLocalAuthAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return isEnrolled;
}

export async function authenticate(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'ロックを解除',
    cancelLabel: 'キャンセル',
    disableDeviceFallback: false,
  });
  return result.success;
}
```

- [ ] **Step 2: 型チェックが通ることを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "services/localAuth: expo-local-authenticationのラッパを追加"
```

---

## Task 10: exportService

**Files:**
- Create: `src/services/exportService.ts`
- Test: `src/services/exportService.test.ts`

役割: 全エントリを JSON 化し、ファイル書き出し+シェアシート起動。テストは JSON 整形ロジックのみ対象 (FS とシェアはモック)。

- [ ] **Step 1: テストを書く**

`src/services/exportService.test.ts`:

```ts
import { buildExportJson } from './exportService';
import type { Entry } from '../types';

describe('buildExportJson', () => {
  test('produces v1 schema with entries in date desc order', () => {
    const entries: Entry[] = [
      { date: '2026-04-28', text: 'a', createdAt: 1000, updatedAt: 1000 },
      { date: '2026-04-27', text: 'b', createdAt: 900, updatedAt: 900 },
    ];
    const json = buildExportJson(entries, '2026-04-28T12:34:56.789Z', '1.0.0');
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toBe('2026-04-28T12:34:56.789Z');
    expect(parsed.appVersion).toBe('1.0.0');
    expect(parsed.entries).toEqual(entries);
  });

  test('handles empty entries list', () => {
    const json = buildExportJson([], '2026-04-28T00:00:00.000Z', '1.0.0');
    expect(JSON.parse(json).entries).toEqual([]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/services/exportService.test.ts
```

期待: モジュール解決エラー

- [ ] **Step 3: 実装を書く**

`src/services/exportService.ts`:

```ts
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Entry } from '../types';
import { today } from '../utils/date';

export function buildExportJson(
  entries: Entry[],
  exportedAt: string,
  appVersion: string
): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt,
      appVersion,
      entries,
    },
    null,
    2
  );
}

export async function exportEntries(
  entries: Entry[],
  appVersion: string
): Promise<void> {
  const json = buildExportJson(entries, new Date().toISOString(), appVersion);
  const fileName = `diary_${today()}.json`;
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: '一文日記をエクスポート',
    UTI: 'public.json',
  });
}
```

- [ ] **Step 4: テストがパスすることを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/services/exportService.test.ts
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "services/exportService: JSONエクスポート機能を追加"
```

---

## Task 11: SettingsContext

**Files:**
- Create: `src/contexts/SettingsContext.tsx`

役割: 起動時に `loadSettings()` で読込、`updateSettings(partial)` で部分更新+永続化。リマインダー関連の値が変わったら `rescheduleDailyReminder` を呼ぶ。

- [ ] **Step 1: 実装を書く**

`src/contexts/SettingsContext.tsx`:

```tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Alert } from 'react-native';
import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { loadSettings, saveSettings } from '../repositories/settingsRepository';
import {
  rescheduleDailyReminder,
  cancelAllReminders,
  requestNotificationPermission,
} from '../services/notifications';

type SettingsContextValue = {
  settings: Settings;
  ready: boolean;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const loaded = await loadSettings();
        setSettings(loaded);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const updateSettings = useCallback(
    async (partial: Partial<Settings>) => {
      const next = { ...settings, ...partial };

      if (
        partial.reminderEnabled === true &&
        settings.reminderEnabled === false
      ) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          Alert.alert(
            '通知が許可されていません',
            '設定アプリから通知を許可してください'
          );
          next.reminderEnabled = false;
        }
      }

      setSettings(next);
      await saveSettings(next);

      try {
        if (next.reminderEnabled) {
          await rescheduleDailyReminder(next.reminderHour, next.reminderMinute);
        } else {
          await cancelAllReminders();
        }
      } catch (e) {
        console.error('Failed to reschedule reminder', e);
      }
    },
    [settings]
  );

  const value = useMemo(
    () => ({ settings, ready, updateSettings }),
    [settings, ready, updateSettings]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const v = useContext(SettingsContext);
  if (!v) throw new Error('useSettings must be used within SettingsProvider');
  return v;
}
```

- [ ] **Step 2: 型チェックが通ることを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "SettingsContext: 設定の読込・更新と通知リスケジュールを追加"
```

---

## Task 12: EntriesContext

**Files:**
- Create: `src/contexts/EntriesContext.tsx`

役割: DB を起動時に open し、entries キャッシュを保持。CRUD 関数とストリーク値を提供。

- [ ] **Step 1: 実装を書く**

`src/contexts/EntriesContext.tsx`:

```tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { DiaryDatabase } from '../db/database';
import { openDatabase } from '../db/database';
import type { Entry } from '../types';
import {
  upsertEntry as repoUpsert,
  getEntryByDate as repoGetByDate,
  deleteEntry as repoDelete,
  getAllEntriesDesc,
  getDatesInMonth as repoDatesInMonth,
  getAllDatesDesc,
} from '../repositories/entriesRepository';
import { calculateStreak } from '../utils/streak';
import { today } from '../utils/date';

type EntriesContextValue = {
  ready: boolean;
  initError: string | null;
  retryInit: () => Promise<void>;
  entries: Entry[];
  streak: number;
  upsert: (date: string, text: string) => Promise<void>;
  remove: (date: string) => Promise<void>;
  getByDate: (date: string) => Promise<Entry | null>;
  getDatesInMonth: (year: number, month: number) => Promise<string[]>;
};

const EntriesContext = createContext<EntriesContextValue | null>(null);

export function EntriesProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DiaryDatabase | null>(null);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);

  const init = useCallback(async () => {
    setInitError(null);
    setReady(false);
    try {
      const opened = await openDatabase();
      const list = await getAllEntriesDesc(opened);
      setDb(opened);
      setEntries(list);
      setReady(true);
    } catch (e) {
      console.error('DB init failed', e);
      setInitError('データベースを開けませんでした。アプリを再起動してください。');
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  const refresh = useCallback(async (currentDb: DiaryDatabase) => {
    const list = await getAllEntriesDesc(currentDb);
    setEntries(list);
  }, []);

  const upsert = useCallback(
    async (date: string, text: string) => {
      if (!db) throw new Error('DB not ready');
      await repoUpsert(db, { date, text, now: Date.now() });
      await refresh(db);
    },
    [db, refresh]
  );

  const remove = useCallback(
    async (date: string) => {
      if (!db) throw new Error('DB not ready');
      await repoDelete(db, date);
      await refresh(db);
    },
    [db, refresh]
  );

  const getByDate = useCallback(
    async (date: string) => {
      if (!db) return null;
      return repoGetByDate(db, date);
    },
    [db]
  );

  const getDatesInMonth = useCallback(
    async (year: number, month: number) => {
      if (!db) return [];
      return repoDatesInMonth(db, year, month);
    },
    [db]
  );

  const streak = useMemo(() => {
    const dates = entries.map((e) => e.date);
    return calculateStreak(dates, today());
  }, [entries]);

  const value = useMemo(
    () => ({
      ready,
      initError,
      retryInit: init,
      entries,
      streak,
      upsert,
      remove,
      getByDate,
      getDatesInMonth,
    }),
    [ready, initError, init, entries, streak, upsert, remove, getByDate, getDatesInMonth]
  );

  return (
    <EntriesContext.Provider value={value}>{children}</EntriesContext.Provider>
  );
}

export function useEntries(): EntriesContextValue {
  const v = useContext(EntriesContext);
  if (!v) throw new Error('useEntries must be used within EntriesProvider');
  return v;
}
```

- [ ] **Step 2: 型チェックが通ることを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "EntriesContext: DB初期化・エントリCRUD・ストリーク計算を追加"
```

---

## Task 13: AuthLockContext

**Files:**
- Create: `src/contexts/AuthLockContext.tsx`

役割: ロック状態を保持。起動時に `lockEnabled` なら locked、`unlock()` で解除。`AppState` の active 復帰時に自動 lock。

- [ ] **Step 1: 実装を書く**

`src/contexts/AuthLockContext.tsx`:

```tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSettings } from './SettingsContext';

type AuthLockContextValue = {
  isLocked: boolean;
  unlock: () => void;
};

const AuthLockContext = createContext<AuthLockContextValue | null>(null);

export function AuthLockProvider({ children }: { children: React.ReactNode }) {
  const { settings, ready } = useSettings();
  const [isLocked, setIsLocked] = useState(false);
  const lockEnabledRef = useRef(settings.lockEnabled);

  useEffect(() => {
    lockEnabledRef.current = settings.lockEnabled;
  }, [settings.lockEnabled]);

  useEffect(() => {
    if (ready) {
      setIsLocked(settings.lockEnabled);
    }
  }, [ready, settings.lockEnabled]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && lockEnabledRef.current) {
        setIsLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback(() => setIsLocked(false), []);

  const value = useMemo(() => ({ isLocked, unlock }), [isLocked, unlock]);

  return (
    <AuthLockContext.Provider value={value}>{children}</AuthLockContext.Provider>
  );
}

export function useAuthLock(): AuthLockContextValue {
  const v = useContext(AuthLockContext);
  if (!v) throw new Error('useAuthLock must be used within AuthLockProvider');
  return v;
}
```

- [ ] **Step 2: 型チェックが通ることを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "AuthLockContext: ロック状態管理とバックグラウンド復帰時の再ロックを追加"
```

---

## Task 14: EntryInput component (TDD)

**Files:**
- Create: `src/components/EntryInput.tsx`
- Test: `src/components/EntryInput.test.tsx`

役割: 140 字制限、改行除去、残り文字数表示の `TextInput` ラッパ。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/EntryInput.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EntryInput } from './EntryInput';

describe('EntryInput', () => {
  test('shows initial value and remaining count', () => {
    const { getByDisplayValue, getByTestId } = render(
      <EntryInput value="hello" onChangeText={() => {}} />
    );
    expect(getByDisplayValue('hello')).toBeTruthy();
    expect(getByTestId('remaining-count').props.children).toBe(135);
  });

  test('strips newlines from input', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <EntryInput value="" onChangeText={onChange} />
    );
    fireEvent.changeText(getByTestId('entry-input'), 'a\nb\rc');
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  test('blocks input beyond 140 codepoints', () => {
    const onChange = jest.fn();
    const longText = 'a'.repeat(140);
    const { getByTestId } = render(
      <EntryInput value={longText} onChangeText={onChange} />
    );
    fireEvent.changeText(getByTestId('entry-input'), longText + 'b');
    expect(onChange).not.toHaveBeenCalled();
  });

  test('counts emoji as 1 in remaining count', () => {
    const { getByTestId } = render(
      <EntryInput value="😀😀😀" onChangeText={() => {}} />
    );
    expect(getByTestId('remaining-count').props.children).toBe(137);
  });

  test('allows input that fits exactly at the limit', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <EntryInput value="" onChangeText={onChange} />
    );
    const text = 'a'.repeat(140);
    fireEvent.changeText(getByTestId('entry-input'), text);
    expect(onChange).toHaveBeenCalledWith(text);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/components/EntryInput.test.tsx
```

期待: モジュール解決エラー

- [ ] **Step 3: 実装を書く**

`src/components/EntryInput.tsx`:

```tsx
import React, { useCallback } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { countChars, stripNewlines } from '../utils/text';
import { MAX_TEXT_LENGTH } from '../types';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export function EntryInput({
  value,
  onChangeText,
  placeholder = '今日の一文を書く',
  autoFocus,
}: Props) {
  const handleChange = useCallback(
    (next: string) => {
      const cleaned = stripNewlines(next);
      if (countChars(cleaned) > MAX_TEXT_LENGTH) return;
      onChangeText(cleaned);
    },
    [onChangeText]
  );

  const remaining = MAX_TEXT_LENGTH - countChars(value);

  return (
    <View style={styles.container}>
      <TextInput
        testID="entry-input"
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        multiline={false}
        style={styles.input}
      />
      <Text testID="remaining-count" style={styles.count}>
        {remaining}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 48,
  },
  count: {
    alignSelf: 'flex-end',
    marginTop: 4,
    color: '#888',
    fontSize: 12,
  },
});
```

- [ ] **Step 4: テストがパスすることを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/components/EntryInput.test.tsx
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "EntryInput: 140字制限・改行除去・残り文字数表示の入力コンポーネントを追加"
```

---

## Task 15: StreakBadge component (TDD)

**Files:**
- Create: `src/components/StreakBadge.tsx`
- Test: `src/components/StreakBadge.test.tsx`

役割: ストリーク日数の表示。0 日 / 1 日 / N 日連続 で文言を分岐。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/StreakBadge.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { StreakBadge } from './StreakBadge';

describe('StreakBadge', () => {
  test('shows 0-day message for 0', () => {
    const { getByText } = render(<StreakBadge days={0} />);
    expect(getByText('まだ記録がありません')).toBeTruthy();
  });

  test('shows 1-day message for 1', () => {
    const { getByText } = render(<StreakBadge days={1} />);
    expect(getByText('🔥 1日連続')).toBeTruthy();
  });

  test('shows N-day message for N>=2', () => {
    const { getByText } = render(<StreakBadge days={7} />);
    expect(getByText('🔥 7日連続')).toBeTruthy();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/components/StreakBadge.test.tsx
```

期待: モジュール解決エラー

- [ ] **Step 3: 実装を書く**

`src/components/StreakBadge.tsx`:

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function StreakBadge({ days }: { days: number }) {
  const label = days === 0 ? 'まだ記録がありません' : `🔥 ${days}日連続`;
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 14,
    color: '#e65100',
    fontWeight: '600',
  },
});
```

- [ ] **Step 4: テストがパスすることを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test -- src/components/StreakBadge.test.tsx
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "StreakBadge: 連続日数表示コンポーネントを追加"
```

---

## Task 16: EntryCard component

**Files:**
- Create: `src/components/EntryCard.tsx`

役割: タイムライン用のカード (日付 + 一文)。テストは形だけなので **手動 QA で代替**。

- [ ] **Step 1: 実装を書く**

`src/components/EntryCard.tsx`:

```tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Entry } from '../types';

type Props = {
  entry: Entry;
  onPress: (date: string) => void;
};

export function EntryCard({ entry, onPress }: Props) {
  return (
    <Pressable
      onPress={() => onPress(entry.date)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Text style={styles.date}>{entry.date}</Text>
      <Text style={styles.text}>{entry.text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pressed: {
    opacity: 0.7,
  },
  date: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  text: {
    fontSize: 16,
  },
});
```

- [ ] **Step 2: 型チェックが通ることを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "EntryCard: タイムライン用カードコンポーネントを追加"
```

---

## Task 17: HomeScreen

**Files:**
- Create: `src/screens/HomeScreen.tsx`

役割: 今日の一文を編集・保存。既存があれば prefill。ストリーク表示。

- [ ] **Step 1: 実装を書く**

`src/screens/HomeScreen.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EntryInput } from '../components/EntryInput';
import { StreakBadge } from '../components/StreakBadge';
import { useEntries } from '../contexts/EntriesContext';
import { today } from '../utils/date';

export function HomeScreen() {
  const { ready, initError, retryInit, getByDate, upsert, streak } = useEntries();
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const todayStr = today();

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const e = await getByDate(todayStr);
      setText(e?.text ?? '');
      setLoaded(true);
    })();
  }, [ready, todayStr, getByDate]);

  if (initError) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>{initError}</Text>
        <Pressable onPress={retryInit} style={styles.button}>
          <Text style={styles.buttonText}>再試行</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!ready || !loaded) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>読み込み中…</Text>
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    if (text.trim().length === 0) return;
    try {
      setSaving(true);
      await upsert(todayStr, text);
      Alert.alert('保存しました');
    } catch (e) {
      console.error('save failed', e);
      Alert.alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.date}>{todayStr}</Text>
        <StreakBadge days={streak} />
      </View>
      <View style={styles.body}>
        <EntryInput value={text} onChangeText={setText} autoFocus />
      </View>
      <Pressable
        onPress={handleSave}
        disabled={saving || text.trim().length === 0}
        style={({ pressed }) => [
          styles.button,
          (saving || text.trim().length === 0) && styles.buttonDisabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.buttonText}>保存</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fafafa' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  date: { fontSize: 18, fontWeight: '600' },
  body: { flex: 1 },
  button: {
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: { backgroundColor: '#bbb' },
  pressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorText: { color: '#c00', marginBottom: 16, textAlign: 'center' },
});
```

- [ ] **Step 2: 型チェックが通ることを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "HomeScreen: 今日の一文を書く画面を追加"
```

---

## Task 18: HistoryScreen (Calendar + Timeline + toggle)

**Files:**
- Create: `src/screens/HistoryScreen.tsx`

役割: カレンダー / タイムラインの切り替え。タップで EntryEditorModal を navigation 経由で開く。

- [ ] **Step 1: 実装を書く**

`src/screens/HistoryScreen.tsx`:

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEntries } from '../contexts/EntriesContext';
import { useSettings } from '../contexts/SettingsContext';
import { EntryCard } from '../components/EntryCard';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HistoryScreen() {
  const navigation = useNavigation<Nav>();
  const { entries, getDatesInMonth } = useEntries();
  const { settings, updateSettings } = useSettings();

  const [marked, setMarked] = useState<Record<string, { marked: boolean }>>({});
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const loadMonth = useCallback(
    async (y: number, m: number) => {
      const dates = await getDatesInMonth(y, m);
      const map: Record<string, { marked: boolean }> = {};
      for (const d of dates) {
        map[d] = { marked: true };
      }
      setMarked(map);
    },
    [getDatesInMonth]
  );

  useEffect(() => {
    loadMonth(year, month);
  }, [year, month, loadMonth, entries]);

  const openEditor = (date: string) => {
    navigation.navigate('EntryEditor', { date });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toggleRow}>
        <Pressable
          onPress={() => updateSettings({ viewMode: 'calendar' })}
          style={[styles.tab, settings.viewMode === 'calendar' && styles.tabActive]}
        >
          <Text style={styles.tabText}>カレンダー</Text>
        </Pressable>
        <Pressable
          onPress={() => updateSettings({ viewMode: 'timeline' })}
          style={[styles.tab, settings.viewMode === 'timeline' && styles.tabActive]}
        >
          <Text style={styles.tabText}>タイムライン</Text>
        </Pressable>
      </View>

      {settings.viewMode === 'calendar' ? (
        <Calendar
          markedDates={marked}
          onDayPress={(day: DateData) => openEditor(day.dateString)}
          onMonthChange={(d: DateData) => {
            setYear(d.year);
            setMonth(d.month);
          }}
        />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.date}
          renderItem={({ item }) => <EntryCard entry={item} onPress={openEditor} />}
          ListEmptyComponent={<Text style={styles.empty}>まだ記録がありません</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  toggleRow: { flexDirection: 'row', padding: 8 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#1976d2' },
  tabText: { fontSize: 14 },
  empty: { textAlign: 'center', marginTop: 32, color: '#888' },
});
```

- [ ] **Step 2: 型チェックが通ることを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit
```

期待: `RootStackParamList` 未定義のエラーが出る → Task 22 で `RootNavigator` が作られた時点で解消するため、暫定的に Task 22 まで保留

注: 実装は完了しているので、コミットして進める。型エラーは Task 22 で `RootStackParamList` を定義した時点で消える。

- [ ] **Step 3: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "HistoryScreen: カレンダー/タイムライン切替の履歴画面を追加"
```

---

## Task 19: EntryEditorModal

**Files:**
- Create: `src/screens/EntryEditorModal.tsx`

役割: 過去エントリの表示・編集・削除。Modal として navigation 経由で起動。

- [ ] **Step 1: 実装を書く**

`src/screens/EntryEditorModal.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EntryInput } from '../components/EntryInput';
import { useEntries } from '../contexts/EntriesContext';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'EntryEditor'>;

export function EntryEditorModal({ route, navigation }: Props) {
  const { date } = route.params;
  const { getByDate, upsert, remove } = useEntries();
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(false);

  useEffect(() => {
    (async () => {
      const e = await getByDate(date);
      setText(e?.text ?? '');
      setExists(e !== null);
      setLoaded(true);
    })();
  }, [date, getByDate]);

  const handleSave = async () => {
    if (text.trim().length === 0) return;
    try {
      await upsert(date, text);
      navigation.goBack();
    } catch {
      Alert.alert('保存に失敗しました');
    }
  };

  const handleDelete = () => {
    Alert.alert('削除しますか？', `${date} のエントリを削除します`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(date);
            navigation.goBack();
          } catch {
            Alert.alert('削除に失敗しました');
          }
        },
      },
    ]);
  };

  if (!loaded) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>読み込み中…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.date}>{date}</Text>
      <EntryInput value={text} onChangeText={setText} autoFocus />
      <View style={styles.row}>
        {exists && (
          <Pressable onPress={handleDelete} style={[styles.button, styles.delete]}>
            <Text style={styles.buttonText}>削除</Text>
          </Pressable>
        )}
        <Pressable
          onPress={handleSave}
          disabled={text.trim().length === 0}
          style={[
            styles.button,
            styles.save,
            text.trim().length === 0 && styles.disabled,
          ]}
        >
          <Text style={styles.buttonText}>保存</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fafafa' },
  date: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  row: { flexDirection: 'row', marginTop: 16, gap: 8 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  save: { backgroundColor: '#1976d2' },
  delete: { backgroundColor: '#c62828' },
  disabled: { backgroundColor: '#bbb' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

注: `RootStackParamList` の import は Task 22 で `RootNavigator` を作るまで未定義のため、`npx tsc --noEmit` を実行するとエラーが出る。Task 22 で解消するためここではコミットして進める。

- [ ] **Step 2: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "EntryEditorModal: 過去エントリの編集・削除モーダルを追加"
```

---

## Task 20: SettingsScreen

**Files:**
- Create: `src/screens/SettingsScreen.tsx`

役割: ロック ON/OFF、リマインダー ON/OFF + 時刻ピッカー、エクスポート、アプリ情報。

- [ ] **Step 1: DateTimePicker をインストール**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx expo install @react-native-community/datetimepicker
```

- [ ] **Step 2: 実装を書く**

`src/screens/SettingsScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import { useSettings } from '../contexts/SettingsContext';
import { useEntries } from '../contexts/EntriesContext';
import { isLocalAuthAvailable } from '../services/localAuth';
import { exportEntries } from '../services/exportService';

export function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const { entries } = useEntries();
  const [showPicker, setShowPicker] = useState(false);

  const toggleLock = async (value: boolean) => {
    if (value) {
      const ok = await isLocalAuthAvailable();
      if (!ok) {
        Alert.alert('この端末では生体認証が利用できません');
        return;
      }
    }
    await updateSettings({ lockEnabled: value });
  };

  const handleExport = async () => {
    if (entries.length === 0) {
      Alert.alert('エクスポートする日記がありません');
      return;
    }
    try {
      await exportEntries(entries, Constants.expoConfig?.version ?? '1.0.0');
    } catch (e) {
      console.error(e);
      Alert.alert('エクスポートに失敗しました');
    }
  };

  const onTimeChange = (_event: unknown, date?: Date) => {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (date) {
      updateSettings({
        reminderHour: date.getHours(),
        reminderMinute: date.getMinutes(),
      });
    }
  };

  const reminderTimeLabel = `${String(settings.reminderHour).padStart(2, '0')}:${String(
    settings.reminderMinute
  ).padStart(2, '0')}`;

  const pickerDate = new Date();
  pickerDate.setHours(settings.reminderHour, settings.reminderMinute, 0, 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.row}>
          <Text style={styles.label}>生体認証ロック</Text>
          <Switch value={settings.lockEnabled} onValueChange={toggleLock} />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>リマインダー通知</Text>
          <Switch
            value={settings.reminderEnabled}
            onValueChange={(v) => updateSettings({ reminderEnabled: v })}
          />
        </View>

        {settings.reminderEnabled && (
          <Pressable onPress={() => setShowPicker(true)} style={styles.row}>
            <Text style={styles.label}>通知時刻</Text>
            <Text style={styles.value}>{reminderTimeLabel}</Text>
          </Pressable>
        )}

        {showPicker && (
          <DateTimePicker
            value={pickerDate}
            mode="time"
            is24Hour
            onChange={onTimeChange}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          />
        )}

        <Pressable onPress={handleExport} style={styles.exportButton}>
          <Text style={styles.exportText}>データをエクスポート</Text>
        </Pressable>

        <Text style={styles.version}>
          バージョン: {Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: { fontSize: 16 },
  value: { fontSize: 16, color: '#666' },
  exportButton: {
    marginTop: 32,
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  exportText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  version: { textAlign: 'center', marginTop: 32, color: '#888', fontSize: 12 },
});
```

- [ ] **Step 3: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "SettingsScreen: ロック・リマインダー・エクスポート設定画面を追加"
```

---

## Task 21: LockScreen

**Files:**
- Create: `src/screens/LockScreen.tsx`

役割: 起動時 / バックグラウンド復帰時のロック解除画面。マウント時に自動で生体認証を要求、再試行可能。

- [ ] **Step 1: 実装を書く**

`src/screens/LockScreen.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { authenticate, isLocalAuthAvailable } from '../services/localAuth';
import { useAuthLock } from '../contexts/AuthLockContext';

export function LockScreen() {
  const { unlock } = useAuthLock();
  const [error, setError] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);

  const tryAuth = useCallback(async () => {
    setError(null);
    setAuthenticating(true);
    try {
      const available = await isLocalAuthAvailable();
      if (!available) {
        setError('設定アプリから生体認証を有効にしてください');
        return;
      }
      const ok = await authenticate();
      if (ok) {
        unlock();
      } else {
        setError('認証に失敗しました');
      }
    } finally {
      setAuthenticating(false);
    }
  }, [unlock]);

  useEffect(() => {
    tryAuth();
  }, [tryAuth]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🔒 ロックされています</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable
          onPress={tryAuth}
          disabled={authenticating}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>
            {authenticating ? '認証中…' : '認証する'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  title: { fontSize: 24, marginBottom: 32 },
  error: { color: '#c00', marginBottom: 16 },
  button: {
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  pressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 2: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "LockScreen: 生体認証によるロック解除画面を追加"
```

---

## Task 22: RootNavigator + App.tsx 配線

**Files:**
- Create: `src/navigation/RootNavigator.tsx`
- Modify: `App.tsx` (Expo 生成のものを置き換え)

役割: NavigationContainer、Stack ナビゲータ、Bottom Tabs。Provider 階層 (Settings → Entries → AuthLock → Navigator) を構成。

- [ ] **Step 1: RootNavigator を作成**

`src/navigation/RootNavigator.tsx`:

```tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/HomeScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { EntryEditorModal } from '../screens/EntryEditorModal';
import { LockScreen } from '../screens/LockScreen';
import { useAuthLock } from '../contexts/AuthLockContext';
import { useSettings } from '../contexts/SettingsContext';
import { View, Text } from 'react-native';

export type RootStackParamList = {
  MainTabs: undefined;
  EntryEditor: { date: string };
};

export type MainTabsParamList = {
  Home: undefined;
  History: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabsParamList>();

function MainTabs() {
  return (
    <Tabs.Navigator>
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: '今日' }} />
      <Tabs.Screen name="History" component={HistoryScreen} options={{ title: '履歴' }} />
      <Tabs.Screen name="Settings" component={SettingsScreen} options={{ title: '設定' }} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { isLocked } = useAuthLock();
  const { ready } = useSettings();

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>起動中…</Text>
      </View>
    );
  }

  if (isLocked) {
    return <LockScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EntryEditor"
          component={EntryEditorModal}
          options={{ presentation: 'modal', title: '編集' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 2: `App.tsx` を Provider 階層に置き換え**

`App.tsx`:

```tsx
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SettingsProvider } from './src/contexts/SettingsContext';
import { EntriesProvider } from './src/contexts/EntriesContext';
import { AuthLockProvider } from './src/contexts/AuthLockContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <EntriesProvider>
          <AuthLockProvider>
            <StatusBar style="auto" />
            <RootNavigator />
          </AuthLockProvider>
        </EntriesProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 3: 型チェックが通ることを確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit
```

期待: エラーなし (Task 18 で出ていた `RootStackParamList` のエラーもここで解消)

- [ ] **Step 4: 全テストを通す**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npm test
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "Navigator・App.tsx: Provider階層と画面遷移を配線"
```

---

## Task 23: 起動確認 & 手動 QA

**Files:** なし (確認作業のみ)

- [ ] **Step 1: Expo dev server を起動**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx expo start
```

QR コードをスマホ (Expo Go) でスキャン。または iOS シミュレータ / Android エミュレータで起動。

- [ ] **Step 2: 手動 QA チェックリスト**

仕様書 §7.3 の項目を順に確認する:

- [ ] 今日の一文を書いて保存できる (Home 画面で入力 → 保存ボタン)
- [ ] 同じ日に開き直すと内容が残っている (再起動 → Home 画面)
- [ ] 同日に編集できる (内容を変えて保存 → 再表示)
- [ ] 文字数制限が機能する (140字 + 1 字を試す → 入力が無視される)
- [ ] 改行を入力しようとしても入らない (キーボードの改行キーを押しても無反応)
- [ ] 絵文字 1 つは 1 字としてカウントされる
- [ ] カレンダーモードで書いた日にドット表示
- [ ] カレンダーの日付タップで Modal 起動
- [ ] タイムラインモードで日付降順表示
- [ ] タイムラインのカードタップで Modal 起動
- [ ] Modal で過去エントリを編集できる
- [ ] Modal で過去エントリを削除できる (確認ダイアログあり)
- [ ] カレンダー / タイムラインのトグルが効く
- [ ] アプリ再起動時に最後の表示モードが復元される
- [ ] リマインダー設定 ON → 時刻ピッカーで時刻設定 → 通知が指定時刻に来る
- [ ] リマインダー OFF にすると通知が来ない
- [ ] 通知権限を拒否した場合は Switch が OFF に戻り、Alert 表示
- [ ] 生体認証 ON にした後、アプリを再起動するとロック画面が出る
- [ ] 生体認証成功で MainTabs に遷移
- [ ] バックグラウンドに移行 → 復帰でロック画面が再表示される
- [ ] 生体認証 OFF ならロック画面は出ない
- [ ] エクスポートボタンでシェアシートが起動、JSON が正しい (出力ファイルを開いて確認)
- [ ] エントリ 0 件のときエクスポートボタン押下で「エクスポートする日記がありません」Alert
- [ ] iOS と Android の両方で同じ動作確認 (上記を両 OS で実施)

- [ ] **Step 3: 起動とリリースビルド確認**

```bash
cd C:/Users/lu/work/one-sentence-diary-app && npx tsc --noEmit && npm test
```

期待: 型エラーなし、全テスト PASS

- [ ] **Step 4: 最終コミット (もし手動 QA で軽微な修正があった場合)**

修正があれば:

```bash
cd C:/Users/lu/work/one-sentence-diary-app && jj commit -m "QAフィードバックを反映: <修正内容>"
```

修正がなければスキップ。

---

## 完了基準

- [ ] 全 23 タスクの全 Step がチェック済み
- [ ] `npx tsc --noEmit` がエラーなし
- [ ] `npm test` が全 PASS
- [ ] 仕様書 §7.3 の手動 QA チェックリストが全項目クリア
- [ ] iOS / Android 両方で実機/シミュレータ確認済み
