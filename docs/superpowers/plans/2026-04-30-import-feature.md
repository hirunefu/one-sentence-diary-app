# インポート機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** エクスポート済み JSON ファイルを読み込んで、機種変更時のデータ移行とバックアップからの復元を同じ画面で扱えるインポート機能を `SettingsScreen` に追加する。

**Architecture:** 純粋関数 (`parseImportJson` / `classifyEntries`) と DB 層 (`bulkUpsertEntries`、トランザクション内で衝突解決) を分離する。`importService.applyImport` がそれらを束ね、`EntriesContext.bulkImport` 経由で UI から呼び出す。重複が 0 件なら即実行、1 件以上あれば `ImportConflictModal` でユーザーに方針を選ばせる。

**Tech Stack:** TypeScript strict / React Native (Expo SDK 54) / expo-sqlite / expo-document-picker (新規) / Jest + jest-expo + better-sqlite3 (in-memory) / @testing-library/react-native / jj (jujutsu) for VCS

**Spec:** `docs/superpowers/specs/2026-04-30-import-feature-design.md`

**重要な前提:**
- VCS は **jj (jujutsu)** を使う。`git commit` ではなく `jj describe -m "..." && jj new -m "(no description set)"` のパターン
- コミットメッセージは日本語
- テスト実行は `npm test -- <pattern>`
- `node_modules` は `.gitignore` 対象 (Windows ジャンクション対策)
- テストの DB は `openTestDatabase()` で in-memory better-sqlite3
- 通知の絶対パスはすべて `C:\Users\lu\work\one-sentence-diary-app` 起点

---

## ファイル構成

新規作成:
- `src/services/importService.ts` — 純粋関数 (parseImportJson, classifyEntries) + 適用 (applyImport)
- `src/services/importService.test.ts` — 上記のユニットテスト
- `src/components/ImportConflictModal.tsx` — 重複解決モーダル

変更:
- `src/repositories/entriesRepository.ts` — `bulkUpsertEntries` を追加
- `src/repositories/entriesRepository.test.ts` — `bulkUpsertEntries` のテストを追加
- `src/contexts/EntriesContext.tsx` — `bulkImport` メソッドを追加
- `src/screens/SettingsScreen.tsx` — 「データをインポート」ボタンとフロー実装
- `package.json` — `expo-document-picker` を追加

---

### Task 1: expo-document-picker を導入

**Files:**
- Modify: `package.json`

- [ ] **Step 1: SDK 互換版をインストール**

PowerShell 推奨:
```bash
npx expo install expo-document-picker
```

これにより `package.json` の `dependencies` に `expo-document-picker` が SDK 54 互換バージョン (`~14.0.x`) で追加される。

- [ ] **Step 2: 型解決を確認**

`src/services/` で適当な `.ts` ファイルに以下を一時的に書いて型エラーが出ないことを確認:

```ts
import * as DocumentPicker from 'expo-document-picker';
const _t: typeof DocumentPicker.getDocumentAsync = DocumentPicker.getDocumentAsync;
```

確認後、削除。

- [ ] **Step 3: コミット**

```bash
jj describe -m "deps: expo-document-picker を追加 (インポート機能向け)"
jj new -m "(no description set)"
```

---

### Task 2: importService の型と parseImportJson を実装 (TDD)

**Files:**
- Create: `src/services/importService.ts`
- Create: `src/services/importService.test.ts`

- [ ] **Step 1: テストファイルを作成 (失敗するテスト)**

`src/services/importService.test.ts` を新規作成:

```ts
import { parseImportJson, ImportParseError } from './importService';

describe('parseImportJson', () => {
  test('正常な JSON を受け取ると { version, entries } を返す', () => {
    const raw = JSON.stringify({
      version: 1,
      exportedAt: '2026-04-30T00:00:00.000Z',
      appVersion: '1.0.0',
      entries: [
        { date: '2026-04-30', text: 'hello', createdAt: 1, updatedAt: 1 },
      ],
    });
    const parsed = parseImportJson(raw);
    expect(parsed.version).toBe(1);
    expect(parsed.entries).toHaveLength(1);
  });

  test('JSON として不正なら ImportParseError(code=invalid-json) を投げる', () => {
    expect(() => parseImportJson('not json')).toThrow(ImportParseError);
    try {
      parseImportJson('not json');
    } catch (e) {
      expect((e as ImportParseError).code).toBe('invalid-json');
    }
  });

  test('object でなければ invalid-structure', () => {
    try {
      parseImportJson(JSON.stringify([1, 2, 3]));
      fail('should throw');
    } catch (e) {
      expect((e as ImportParseError).code).toBe('invalid-structure');
    }
  });

  test('version !== 1 なら unsupported-version', () => {
    try {
      parseImportJson(JSON.stringify({ version: 2, entries: [] }));
      fail('should throw');
    } catch (e) {
      expect((e as ImportParseError).code).toBe('unsupported-version');
    }
  });

  test('entries が配列でなければ invalid-structure', () => {
    try {
      parseImportJson(JSON.stringify({ version: 1, entries: 'oops' }));
      fail('should throw');
    } catch (e) {
      expect((e as ImportParseError).code).toBe('invalid-structure');
    }
  });
});
```

- [ ] **Step 2: テストを実行して失敗することを確認**

```bash
npm test -- importService
```

期待: `Cannot find module './importService'` で全テスト失敗。

- [ ] **Step 3: importService.ts に最小実装**

`src/services/importService.ts` を新規作成:

```ts
export type ImportFileV1 = {
  version: 1;
  exportedAt?: string;
  appVersion?: string;
  entries: unknown[];
};

export type ImportParseErrorCode =
  | 'invalid-json'
  | 'invalid-structure'
  | 'unsupported-version';

export class ImportParseError extends Error {
  readonly code: ImportParseErrorCode;
  constructor(message: string, code: ImportParseErrorCode) {
    super(message);
    this.name = 'ImportParseError';
    this.code = code;
  }
}

export function parseImportJson(raw: string): ImportFileV1 {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ImportParseError('JSON のパースに失敗しました', 'invalid-json');
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new ImportParseError(
      'ファイル形式が一口日記のエクスポートと一致しません',
      'invalid-structure'
    );
  }
  const obj = data as Record<string, unknown>;
  if (obj.version !== 1) {
    throw new ImportParseError(
      '対応していないバージョンです',
      'unsupported-version'
    );
  }
  if (!Array.isArray(obj.entries)) {
    throw new ImportParseError(
      'ファイル形式が一口日記のエクスポートと一致しません',
      'invalid-structure'
    );
  }
  return { version: 1, entries: obj.entries };
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test -- importService
```

期待: 5 件すべて pass。

- [ ] **Step 5: コミット**

```bash
jj describe -m "importService: parseImportJson と ImportParseError を追加"
jj new -m "(no description set)"
```

---

### Task 3: classifyEntries (純粋関数で 3 分類) を実装 (TDD)

**Files:**
- Modify: `src/services/importService.ts`
- Modify: `src/services/importService.test.ts`

- [ ] **Step 1: テストを追加 (失敗するテスト)**

`src/services/importService.test.ts` の末尾に追記:

```ts
import { classifyEntries } from './importService';

describe('classifyEntries', () => {
  const existingDates = new Set(['2026-04-29']);

  test('有効・新規・重複・不正を正しく分類する', () => {
    const raw = [
      { date: '2026-04-30', text: 'new', createdAt: 1, updatedAt: 1 },     // 新規
      { date: '2026-04-29', text: 'dup', createdAt: 1, updatedAt: 1 },     // 重複
      { date: '2026-13-01', text: 'bad date', createdAt: 1, updatedAt: 1 }, // 不正(日付)
      { date: '2026-04-28', text: '', createdAt: 1, updatedAt: 1 },         // 不正(空)
      { date: '2026-04-27', text: 'a\nb', createdAt: 1, updatedAt: 1 },     // 不正(改行)
      { date: '2026-04-26', text: 'x'.repeat(141), createdAt: 1, updatedAt: 1 }, // 不正(141字)
      { date: '2026-04-25', text: 'no time', createdAt: 'oops', updatedAt: 1 }, // 不正(型)
      'not an object',                                                      // 不正(型)
      null,                                                                 // 不正(null)
    ];
    const r = classifyEntries(raw, existingDates);
    expect(r.newEntries).toEqual([
      { date: '2026-04-30', text: 'new', createdAt: 1, updatedAt: 1 },
    ]);
    expect(r.conflicts).toEqual([
      { date: '2026-04-29', text: 'dup', createdAt: 1, updatedAt: 1 },
    ]);
    expect(r.invalid).toBe(7);
  });

  test('140 字ちょうどは有効、surrogate pair も 1 codepoint と数える', () => {
    const text = 'あ'.repeat(140);
    const r = classifyEntries(
      [{ date: '2026-04-30', text, createdAt: 1, updatedAt: 1 }],
      new Set()
    );
    expect(r.newEntries).toHaveLength(1);
  });

  test('絵文字 (surrogate pair) は 1 codepoint としてカウントされる', () => {
    const text = '😀'.repeat(140);
    const r = classifyEntries(
      [{ date: '2026-04-30', text, createdAt: 1, updatedAt: 1 }],
      new Set()
    );
    expect(r.newEntries).toHaveLength(1);
  });

  test('CR (\\r) も改行として不正扱い', () => {
    const r = classifyEntries(
      [{ date: '2026-04-30', text: 'a\rb', createdAt: 1, updatedAt: 1 }],
      new Set()
    );
    expect(r.newEntries).toHaveLength(0);
    expect(r.invalid).toBe(1);
  });

  test('空配列を渡すと全部 0', () => {
    const r = classifyEntries([], new Set());
    expect(r.newEntries).toEqual([]);
    expect(r.conflicts).toEqual([]);
    expect(r.invalid).toBe(0);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- importService
```

期待: classifyEntries が undefined で fail。

- [ ] **Step 3: importService.ts に追加実装**

`src/services/importService.ts` の末尾に追記:

```ts
import type { Entry } from '../types';
import { MAX_TEXT_LENGTH } from '../types';
import { countChars } from '../utils/text';

export type ClassifiedEntries = {
  newEntries: Entry[];
  conflicts: Entry[];
  invalid: number;
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(s: string): boolean {
  if (!DATE_REGEX.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

function isValidEntry(e: unknown): e is Entry {
  if (e === null || typeof e !== 'object') return false;
  const r = e as Record<string, unknown>;
  if (typeof r.date !== 'string' || !isValidDate(r.date)) return false;
  if (typeof r.text !== 'string') return false;
  const len = countChars(r.text);
  if (len < 1 || len > MAX_TEXT_LENGTH) return false;
  if (/[\r\n]/.test(r.text)) return false;
  if (typeof r.createdAt !== 'number') return false;
  if (typeof r.updatedAt !== 'number') return false;
  return true;
}

export function classifyEntries(
  rawEntries: unknown[],
  existingDates: ReadonlySet<string>
): ClassifiedEntries {
  const newEntries: Entry[] = [];
  const conflicts: Entry[] = [];
  let invalid = 0;
  for (const raw of rawEntries) {
    if (!isValidEntry(raw)) {
      invalid++;
      continue;
    }
    if (existingDates.has(raw.date)) {
      conflicts.push(raw);
    } else {
      newEntries.push(raw);
    }
  }
  return { newEntries, conflicts, invalid };
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test -- importService
```

期待: 既存の parse 系 5 件 + 新規 5 件 = 10 件すべて pass。

- [ ] **Step 5: コミット**

```bash
jj describe -m "importService: classifyEntries で entries を新規/重複/不正に分類"
jj new -m "(no description set)"
```

---

### Task 4: bulkUpsertEntries を repository に追加 (TDD)

**Files:**
- Modify: `src/repositories/entriesRepository.ts`
- Modify: `src/repositories/entriesRepository.test.ts`

- [ ] **Step 1: テストを追加 (失敗するテスト)**

`src/repositories/entriesRepository.test.ts` の末尾に追記:

```ts
import { bulkUpsertEntries } from './entriesRepository';

describe('bulkUpsertEntries', () => {
  let db: DiaryDatabase;
  beforeEach(async () => {
    db = await openTestDatabase();
  });
  afterEach(async () => {
    await db.closeAsync();
  });

  test('strategy=overwrite で新規と重複の両方を反映', async () => {
    await upsertEntry(db, { date: '2026-04-29', text: 'old', now: 1000 });
    const result = await bulkUpsertEntries(
      db,
      [{ date: '2026-04-30', text: 'new', createdAt: 2000, updatedAt: 2000 }],
      [{ date: '2026-04-29', text: 'imported', createdAt: 500, updatedAt: 3000 }],
      'overwrite'
    );
    expect(result).toEqual({ inserted: 1, updated: 1, skipped: 0 });
    expect(await getEntryByDate(db, '2026-04-29')).toEqual({
      date: '2026-04-29',
      text: 'imported',
      createdAt: 500, // インポート側の createdAt を保持
      updatedAt: 3000,
    });
    expect(await getEntryByDate(db, '2026-04-30')).toEqual({
      date: '2026-04-30',
      text: 'new',
      createdAt: 2000,
      updatedAt: 2000,
    });
  });

  test('strategy=skip で重複は変更されない', async () => {
    await upsertEntry(db, { date: '2026-04-29', text: 'old', now: 1000 });
    const result = await bulkUpsertEntries(
      db,
      [{ date: '2026-04-30', text: 'new', createdAt: 2000, updatedAt: 2000 }],
      [{ date: '2026-04-29', text: 'imported', createdAt: 500, updatedAt: 3000 }],
      'skip'
    );
    expect(result).toEqual({ inserted: 1, updated: 0, skipped: 1 });
    expect(await getEntryByDate(db, '2026-04-29')).toEqual({
      date: '2026-04-29',
      text: 'old', // 既存のまま
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  test('strategy=newer でインポートが新しければ更新、古ければスキップ', async () => {
    await upsertEntry(db, { date: '2026-04-28', text: 'older', now: 1000 });
    await upsertEntry(db, { date: '2026-04-29', text: 'newer', now: 5000 });
    const result = await bulkUpsertEntries(
      db,
      [],
      [
        { date: '2026-04-28', text: 'i-newer', createdAt: 1, updatedAt: 3000 }, // 既存より新しい
        { date: '2026-04-29', text: 'i-older', createdAt: 1, updatedAt: 2000 }, // 既存より古い
      ],
      'newer'
    );
    expect(result).toEqual({ inserted: 0, updated: 1, skipped: 1 });
    expect((await getEntryByDate(db, '2026-04-28'))?.text).toBe('i-newer');
    expect((await getEntryByDate(db, '2026-04-29'))?.text).toBe('newer');
  });

  test('strategy=newer で同じ updatedAt はスキップ (>=)', async () => {
    await upsertEntry(db, { date: '2026-04-28', text: 'old', now: 1000 });
    const result = await bulkUpsertEntries(
      db,
      [],
      [{ date: '2026-04-28', text: 'imported', createdAt: 1, updatedAt: 1000 }],
      'newer'
    );
    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
    expect((await getEntryByDate(db, '2026-04-28'))?.text).toBe('old');
  });

  test('空配列を渡しても動作する', async () => {
    const result = await bulkUpsertEntries(db, [], [], 'overwrite');
    expect(result).toEqual({ inserted: 0, updated: 0, skipped: 0 });
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- entriesRepository
```

期待: bulkUpsertEntries が undefined で fail。

- [ ] **Step 3: 実装を追加**

`src/repositories/entriesRepository.ts` の末尾に追記:

```ts
export type ImportStrategy = 'overwrite' | 'skip' | 'newer';

export type ImportRecord = {
  date: string;
  text: string;
  createdAt: number;
  updatedAt: number;
};

export type BulkImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
};

export async function bulkUpsertEntries(
  db: DiaryDatabase,
  newEntries: ImportRecord[],
  conflicts: ImportRecord[],
  strategy: ImportStrategy
): Promise<BulkImportResult> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  await db.execAsync('BEGIN');
  try {
    for (const e of newEntries) {
      await db.runAsync(
        `INSERT INTO entries (date, text, created_at, updated_at) VALUES (?, ?, ?, ?)`,
        [e.date, e.text, e.createdAt, e.updatedAt]
      );
      inserted++;
    }

    if (strategy === 'skip') {
      skipped += conflicts.length;
    } else {
      for (const e of conflicts) {
        if (strategy === 'newer') {
          const existing = await db.getFirstAsync<{ updated_at: number }>(
            `SELECT updated_at FROM entries WHERE date = ?`,
            [e.date]
          );
          if (existing && existing.updated_at >= e.updatedAt) {
            skipped++;
            continue;
          }
        }
        await db.runAsync(
          `INSERT INTO entries (date, text, created_at, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(date) DO UPDATE SET
             text = excluded.text,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at`,
          [e.date, e.text, e.createdAt, e.updatedAt]
        );
        updated++;
      }
    }

    await db.execAsync('COMMIT');
  } catch (err) {
    await db.execAsync('ROLLBACK');
    throw err;
  }

  return { inserted, updated, skipped };
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test -- entriesRepository
```

期待: 既存テスト + 新規 5 件 すべて pass。

- [ ] **Step 5: ロールバックのテストを追加**

`describe('bulkUpsertEntries', ...)` ブロック内に追記:

```ts
test('途中で例外が出たら全件ロールバックされる', async () => {
  await upsertEntry(db, { date: '2026-04-29', text: 'old', now: 1000 });
  // 同じ日付を重複させて UNIQUE 制約違反を起こす
  await expect(
    bulkUpsertEntries(
      db,
      [
        { date: '2026-04-30', text: 'a', createdAt: 1, updatedAt: 1 },
        { date: '2026-04-30', text: 'b', createdAt: 1, updatedAt: 1 }, // ← 2 件目で UNIQUE 違反
      ],
      [],
      'overwrite'
    )
  ).rejects.toThrow();
  // 1 件目もロールバックされて存在しない
  expect(await getEntryByDate(db, '2026-04-30')).toBeNull();
  // 既存はそのまま
  expect((await getEntryByDate(db, '2026-04-29'))?.text).toBe('old');
});
```

```bash
npm test -- entriesRepository
```

期待: pass (現実装で BEGIN/ROLLBACK が動いている)。

- [ ] **Step 6: コミット**

```bash
jj describe -m "entriesRepository: bulkUpsertEntries (3 strategy + トランザクション) を追加"
jj new -m "(no description set)"
```

---

### Task 5: applyImport を importService に追加 (TDD)

**Files:**
- Modify: `src/services/importService.ts`
- Modify: `src/services/importService.test.ts`

- [ ] **Step 1: テストを追加 (失敗するテスト)**

`src/services/importService.test.ts` の末尾に追記:

```ts
import { applyImport } from './importService';
import { openTestDatabase } from '../db/testDatabase';
import type { DiaryDatabase } from '../db/database';
import { upsertEntry, getEntryByDate } from '../repositories/entriesRepository';

describe('applyImport', () => {
  let db: DiaryDatabase;
  beforeEach(async () => {
    db = await openTestDatabase();
  });
  afterEach(async () => {
    await db.closeAsync();
  });

  test('classified を bulkUpsertEntries に渡し、invalid 件数を返す', async () => {
    await upsertEntry(db, { date: '2026-04-29', text: 'old', now: 1000 });
    const result = await applyImport(
      db,
      {
        newEntries: [
          { date: '2026-04-30', text: 'new', createdAt: 1, updatedAt: 1 },
        ],
        conflicts: [
          { date: '2026-04-29', text: 'imp', createdAt: 1, updatedAt: 2000 },
        ],
        invalid: 3,
      },
      'overwrite'
    );
    expect(result).toEqual({
      inserted: 1,
      updated: 1,
      skipped: 0,
      invalid: 3,
    });
    expect((await getEntryByDate(db, '2026-04-29'))?.text).toBe('imp');
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- importService
```

期待: applyImport が undefined で fail。

- [ ] **Step 3: 実装を追加**

`src/services/importService.ts` の先頭の import 群を以下に変更 (既存 import の隣に追加):

```ts
import type { DiaryDatabase } from '../db/database';
import {
  bulkUpsertEntries,
  type BulkImportResult,
  type ImportStrategy,
} from '../repositories/entriesRepository';
```

ファイル末尾に追加:

```ts
export type ApplyImportResult = BulkImportResult & { invalid: number };

export async function applyImport(
  db: DiaryDatabase,
  classified: ClassifiedEntries,
  strategy: ImportStrategy
): Promise<ApplyImportResult> {
  const result = await bulkUpsertEntries(
    db,
    classified.newEntries,
    classified.conflicts,
    strategy
  );
  return { ...result, invalid: classified.invalid };
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test -- importService
```

期待: 全件 pass。

- [ ] **Step 5: コミット**

```bash
jj describe -m "importService: applyImport で classified を DB に適用するオーケストレータを追加"
jj new -m "(no description set)"
```

---

### Task 6: EntriesContext に bulkImport を追加

**Files:**
- Modify: `src/contexts/EntriesContext.tsx`

このタスクは UI 結合用の薄いラッパー。ユニットテストは Task 5 でカバー済みなので、ここでは型と実装のみ。

- [ ] **Step 1: import 群と型定義を更新**

`src/contexts/EntriesContext.tsx` 上部の import を変更:

```tsx
import {
  upsertEntry as repoUpsert,
  getEntryByDate as repoGetByDate,
  deleteEntry as repoDelete,
  getAllEntriesDesc,
  getDatesInMonth as repoDatesInMonth,
  getAllDatesDesc,
  type ImportStrategy,
} from '../repositories/entriesRepository';
import {
  applyImport,
  type ClassifiedEntries,
  type ApplyImportResult,
} from '../services/importService';
```

`EntriesContextValue` 型に以下を追加:

```tsx
type EntriesContextValue = {
  // ...既存フィールド
  bulkImport: (
    classified: ClassifiedEntries,
    strategy: ImportStrategy
  ) => Promise<ApplyImportResult>;
};
```

- [ ] **Step 2: bulkImport を実装**

`remove` の useCallback の直下に追加:

```tsx
const bulkImport = useCallback(
  async (
    classified: ClassifiedEntries,
    strategy: ImportStrategy
  ): Promise<ApplyImportResult> => {
    if (!db) throw new Error('DB not ready');
    const result = await applyImport(db, classified, strategy);
    await refresh(db);
    return result;
  },
  [db, refresh]
);
```

`useMemo` の value に `bulkImport` を追加:

```tsx
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
    bulkImport,
  }),
  [ready, initError, init, entries, streak, upsert, remove, getByDate, getDatesInMonth, bulkImport]
);
```

- [ ] **Step 3: 型チェック (tsc) と既存テストが通ることを確認**

```bash
npx tsc --noEmit
npm test
```

期待: tsc エラーなし、全テスト pass。

- [ ] **Step 4: コミット**

```bash
jj describe -m "EntriesContext: bulkImport を追加 (applyImport 呼出し→entries 再取得)"
jj new -m "(no description set)"
```

---

### Task 7: ImportConflictModal コンポーネントを作成

**Files:**
- Create: `src/components/ImportConflictModal.tsx`

- [ ] **Step 1: コンポーネントを作成**

`src/components/ImportConflictModal.tsx` を新規作成:

```tsx
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ImportStrategy } from '../repositories/entriesRepository';
import { useColors } from '../theme/useColors';
import { PressableScale } from './PressableScale';

type Props = {
  visible: boolean;
  totalCount: number;
  newCount: number;
  conflictCount: number;
  invalidCount: number;
  onCancel: () => void;
  onConfirm: (strategy: ImportStrategy) => void;
};

const STRATEGIES: ReadonlyArray<{
  value: ImportStrategy;
  label: string;
  description: string;
}> = [
  { value: 'overwrite', label: '上書き', description: '既存を消してインポート側に置き換える' },
  { value: 'skip', label: 'スキップ', description: '既存を残してインポート側を捨てる' },
  { value: 'newer', label: '新しい方を採用', description: '更新時刻が新しい方を残す' },
];

export function ImportConflictModal({
  visible,
  totalCount,
  newCount,
  conflictCount,
  invalidCount,
  onCancel,
  onConfirm,
}: Props) {
  const colors = useColors();
  const [strategy, setStrategy] = useState<ImportStrategy>('overwrite');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>インポート内容の確認</Text>

          <Text style={[styles.summary, { color: colors.textMuted }]}>
            合計 {totalCount} 件 (新規 {newCount} / 重複 {conflictCount} / 不正 {invalidCount})
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            重複の扱い
          </Text>

          {STRATEGIES.map((opt) => {
            const isSelected = strategy === opt.value;
            return (
              <PressableScale
                key={opt.value}
                onPress={() => setStrategy(opt.value)}
                style={[styles.row, { borderBottomColor: colors.divider }]}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.label, { color: colors.text }]}>{opt.label}</Text>
                  <Text style={[styles.desc, { color: colors.textMuted }]}>
                    {opt.description}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark" size={22} color={colors.primary} />
                )}
              </PressableScale>
            );
          })}

          <View style={styles.actions}>
            <PressableScale onPress={onCancel} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>
                キャンセル
              </Text>
            </PressableScale>
            <PressableScale
              onPress={() => onConfirm(strategy)}
              style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.confirmText, { color: colors.primaryText }]}>
                インポート実行
              </Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 12,
    padding: 20,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  summary: { fontSize: 14, marginBottom: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowText: { flex: 1, paddingRight: 12 },
  label: { fontSize: 16 },
  desc: { fontSize: 12, marginTop: 2 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  cancelText: { fontSize: 16 },
  confirmBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  confirmText: { fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 2: 型チェック**

```bash
npx tsc --noEmit
```

期待: エラーなし。

- [ ] **Step 3: コミット**

```bash
jj describe -m "ImportConflictModal: 重複時の方針選択モーダルを追加"
jj new -m "(no description set)"
```

---

### Task 8: SettingsScreen にインポートボタンとフローを追加

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: import 群を更新**

`src/screens/SettingsScreen.tsx` 先頭の import を以下のように追加:

```tsx
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import {
  parseImportJson,
  classifyEntries,
  ImportParseError,
  type ClassifiedEntries,
} from '../services/importService';
import type { ImportStrategy } from '../repositories/entriesRepository';
import { ImportConflictModal } from '../components/ImportConflictModal';
```

- [ ] **Step 2: state とハンドラを追加**

`SettingsScreen` 関数の中、既存の `const { entries } = useEntries();` を以下に置き換え:

```tsx
const { entries, bulkImport } = useEntries();
const [pendingImport, setPendingImport] = useState<ClassifiedEntries | null>(null);
```

`handleExport` の直下に以下を追加:

```tsx
const reportImportResult = (result: {
  inserted: number;
  updated: number;
  skipped: number;
  invalid: number;
}) => {
  const { inserted, updated, skipped, invalid } = result;
  const total = inserted + updated;
  const detail = `内訳: 新規 ${inserted} / 上書き ${updated} / スキップ ${skipped} / 不正 ${invalid}`;
  if (total === 0 && invalid === 0 && skipped === 0) {
    Alert.alert('インポートする日記がありませんでした');
  } else {
    Alert.alert('インポートが完了しました', `${total} 件取り込みました\n${detail}`);
  }
};

const runImport = async (
  classified: ClassifiedEntries,
  strategy: ImportStrategy
) => {
  try {
    const result = await bulkImport(classified, strategy);
    reportImportResult(result);
  } catch (e) {
    console.error('import failed', e);
    Alert.alert('インポートに失敗しました');
  }
};

const handleImport = async () => {
  let pickResult: DocumentPicker.DocumentPickerResult;
  try {
    pickResult = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
      multiple: false,
    });
  } catch (e) {
    console.error('document picker failed', e);
    Alert.alert('ファイルを開けませんでした');
    return;
  }
  if (pickResult.canceled) return;
  const asset = pickResult.assets[0];
  if (!asset) return;

  let raw: string;
  try {
    const file = new File(asset.uri);
    raw = file.text();
  } catch (e) {
    console.error('file read failed', e);
    Alert.alert('ファイルを読み込めませんでした');
    return;
  }

  let parsed;
  try {
    parsed = parseImportJson(raw);
  } catch (e) {
    if (e instanceof ImportParseError) {
      Alert.alert('インポートできません', e.message);
    } else {
      Alert.alert('ファイルを読み込めませんでした');
    }
    return;
  }

  const existingDates = new Set(entries.map((e) => e.date));
  const classified = classifyEntries(parsed.entries, existingDates);

  if (classified.conflicts.length === 0) {
    await runImport(classified, 'skip'); // strategy は重複なしなら何でも良い
    return;
  }

  setPendingImport(classified);
};

const handleConfirmImport = async (strategy: ImportStrategy) => {
  const classified = pendingImport;
  setPendingImport(null);
  if (!classified) return;
  await runImport(classified, strategy);
};

const handleCancelImport = () => setPendingImport(null);
```

- [ ] **Step 3: UI を追加**

既存の `データをエクスポート` の `PressableScale` の直下に以下を追加 (エクスポートが primary 色のソリッドボタンなので、インポートはセカンダリ風に: 透明地 + 枠線):

```tsx
<PressableScale
  onPress={handleImport}
  style={[
    styles.exportButton,
    {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 12,
    },
  ]}
>
  <Text style={[styles.exportText, { color: colors.text }]}>データをインポート</Text>
</PressableScale>
```

`</ScrollView>` の直前 (= SafeAreaView の中、ScrollView の直後) に Modal を追加:

```tsx
{pendingImport && (
  <ImportConflictModal
    visible={true}
    totalCount={
      pendingImport.newEntries.length +
      pendingImport.conflicts.length +
      pendingImport.invalid
    }
    newCount={pendingImport.newEntries.length}
    conflictCount={pendingImport.conflicts.length}
    invalidCount={pendingImport.invalid}
    onCancel={handleCancelImport}
    onConfirm={handleConfirmImport}
  />
)}
```

- [ ] **Step 4: 型チェックと既存テスト**

```bash
npx tsc --noEmit
npm test
```

期待: エラーなし、全テスト pass。

- [ ] **Step 5: コミット**

```bash
jj describe -m "SettingsScreen: インポートボタンとフロー (DocumentPicker→検証→確認→適用) を追加"
jj new -m "(no description set)"
```

---

### Task 9: 動作確認 (実機 or エミュレータ) と最終調整

**Files:** なし (検証のみ)

このタスクはユーザー (人間) と一緒に確認する。コードが書けないエージェントは「以下の手順を実行して結果を報告してください」と指示する。

- [ ] **Step 1: 開発ビルドを起動**

```bash
npm start
```

別ターミナルで Android 端末/エミュレータを起動し、Expo Dev Client か Expo Go から接続。

- [ ] **Step 2: 既存の機能で日記を 2-3 件作成**

任意の日付に日記を入力し、保存。

- [ ] **Step 3: エクスポートして JSON を入手**

設定 → 「データをエクスポート」→ 共有先で「ファイルに保存」などを選び、`Download` などにコピーしておく。

- [ ] **Step 4: 既存日記を 1 件だけ削除し、エクスポートした JSON を編集**

エクスポートした JSON をテキストエディタで開き、以下のように改造:
- 1 件の `text` を別の文字列に書き換える (重複時の上書き挙動を見る)
- 1 件追加する (新規追加挙動を見る)
- 1 件 `text` を 200 文字にする (不正としてスキップされる挙動を見る)

そのファイルを再度端末に置く。

- [ ] **Step 5: インポート実行**

設定 → 「データをインポート」→ ファイル選択 → モーダルで方針選択 → 実行。

期待される結果:
- 完了アラートに「N 件取り込みました 内訳: 新規 X / 上書き Y / スキップ Z / 不正 W」が出る
- 履歴画面に新規日付の日記が表示される
- 既存日付の text が「上書き」を選んだ場合だけ更新されている
- 不正な 200 文字の日記は取り込まれていない

- [ ] **Step 6: 異常系の確認**

- 適当なテキストファイルを `.json` にリネームしてインポート → 「ファイル形式が一口日記のエクスポートと一致しません」が出る
- インポートをキャンセル → 何も起きない (静かに戻る)

- [ ] **Step 7: 既存テスト全体のグリーンを最終確認**

```bash
npm test
```

期待: 全 suite pass。

- [ ] **Step 8: 最終コミット (空の場合スキップ)**

ここまでにコミット漏れの調整があれば:

```bash
jj status   # 変更があるか確認
jj describe -m "インポート機能: 動作確認時の微調整"
jj new -m "(no description set)"
```

変更がなければ:

```bash
jj abandon  # 空の作業コピーを破棄
```

---

## 完了条件

- [ ] `npm test` が全件 pass
- [ ] `npx tsc --noEmit` がエラーなし
- [ ] 設定画面に「データをインポート」ボタンが表示される
- [ ] 重複ゼロのインポートはモーダルなしで完了する
- [ ] 重複ありのインポートはモーダルで方針を選んでから完了する
- [ ] 不正データはスキップされ、件数が報告される
- [ ] 構造的に壊れた JSON は中断され、エラー表示される
- [ ] トランザクション中の例外でロールバックされる (テストで確認)

## Spec との差分メモ

- spec の「結合 (testing-library/react-native)」テストは、`expo-document-picker` と `expo-file-system` の File クラスのモック整備コストが高いため、Task 9 の手動スモークテストで代替する。個人アプリで利用者は本人のみ、UI 結合不具合は実機でのスモーク確認で十分検出可能と判断。後で誰かが本格的な自動 UI 結合テストを追加したくなった場合に備えて、importService 側はピュア関数で完全にテスト済みなので結合テストはモッキングだけに集中できる構造になっている。
