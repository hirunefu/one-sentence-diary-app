# インポート機能 設計

- 日付: 2026-04-30
- 対象: 一口日記 (one-sentence-diary-app)
- 目的: エクスポート済み JSON ファイルを読み込んで、日記データを取り込めるようにする

## 背景と目的

現状、`src/services/exportService.ts` で全エントリを以下のスキーマで JSON エクスポートできる：

```json
{
  "version": 1,
  "exportedAt": "2026-04-28T12:34:56.789Z",
  "appVersion": "1.0.0",
  "entries": [
    { "date": "2026-04-28", "text": "...", "createdAt": 1000, "updatedAt": 1000 }
  ]
}
```

一方インポート手段がなく、以下のユースケースに対応できていない：

- **機種変更時のデータ移行** (旧端末でエクスポート → 新端末で空 DB に取り込み)
- **バックアップからの復元** (定期的にエクスポートしておき、誤削除や端末故障時に既存 DB へ復元)

両方を同じ画面・同じフローで扱える、シンプルで安全なインポート機能を追加する。

## 全体像

`SettingsScreen` の「データをエクスポート」直下に「データをインポート」ボタンを追加する。タップで `expo-document-picker` を起動 → ユーザーが JSON を選ぶ → 構造検証 → 個別エントリの分類 → (重複があれば確認モーダル) → DB に一括適用 → 結果通知。

## UI / トリガー

- `src/screens/SettingsScreen.tsx` の「データをエクスポート」ボタンの直下に「データをインポート」ボタンを追加
- タップで `expo-document-picker` を起動 (`type: 'application/json'`)
- ユーザーが JSON ファイルを選択

## 処理フロー

```
[ファイル選択]
   ↓
[JSON パース＋構造検証]
   ├ 構造不正 / 未知バージョン → エラーモーダル → 中断
   ↓
[個別エントリを 3つに分類]
   - 有効・新規 (既存にない日付)
   - 有効・重複 (既存と日付が同じ)
   - 不正    (バリデーション失敗)
   ↓
[重複ゼロ?]
  ├ Yes → DB に一括適用 → 完了通知「N件取り込みました (K件スキップ)」
  └ No  → 重複モーダル
            「N件中、有効M件、不正K件、既存と重複J件。重複の扱いは?」
            ○ 上書き
            ○ スキップ
            ○ 新しい方を採用 (updatedAt 比較)
            [インポート実行] [キャンセル]
            ↓ 実行
          DB に一括適用 → 完了通知
```

## バリデーション規則

### 構造 (厳格・1つでも違反したらファイル全体を拒否)

- ルートが object であること
- `version === 1` であること (将来 `version: 2` を追加する余地を残し、未知バージョンは拒否する)
- `entries` が Array であること

### 個別エントリ (緩め・違反したものだけスキップ)

- `date`: `YYYY-MM-DD` 形式の文字列で、実在する暦日 (`2026-13-01` などは不正)
- `text`: 文字列、1〜140 codepoint、改行を含まない (現行の入力ルールに合わせる)
- `createdAt`: 数値
- `updatedAt`: 数値

これらのいずれかが満たされない場合、そのエントリは「不正」として除外し、件数を集計してユーザーに報告する。

## 衝突解決の挙動詳細

「重複」(= 同じ `date` の既存エントリがある) の扱いはユーザーがモーダルで選んだ方針に従う：

- **上書き**: `INSERT ... ON CONFLICT(date) DO UPDATE` でインポート側の `text` / `createdAt` / `updatedAt` を採用 (旧端末で書いた時刻を保持したいため `createdAt` も更新する)
- **スキップ**: 重複日付は INSERT 自体を発行しない
- **新しい方を採用**: 既存とインポートの `updatedAt` を比較し、インポート側が新しければ上書き、そうでなければスキップ

新規 (重複なし) 日付は、いずれの選択肢でも常に追加される。

## アトミック性

DB トランザクション内で全件の INSERT/UPDATE を実行する。途中で例外が出たら全件ロールバックし、「全部成功 or 何も変わらない」のどちらかになるよう保証する。これにより、部分的に取り込まれた中途半端な状態を避ける。

## モジュール構成

新規/変更ファイル:

- `src/services/importService.ts` (新規)
  - `parseImportJson(raw: string): { version: 1; entries: unknown[] }` — 構造検証 (失敗時は `Error` を throw)
  - `classifyEntries(rawEntries: unknown[], existingDates: ReadonlySet<string>): ClassifiedEntries` — 純粋関数で 3分類
  - `applyImport(db, classified, strategy): Promise<{ inserted: number; updated: number; skipped: number; invalid: number }>` — トランザクションで一括適用
- `src/repositories/entriesRepository.ts` (拡張)
  - `bulkUpsertEntries(db, entries, strategy)` を追加 (既存 `upsertEntry` は単件用なのでそのまま残す)
- `src/components/ImportConflictModal.tsx` (新規) — 重複確認モーダル (件数表示と方針選択)
- `src/screens/SettingsScreen.tsx` (拡張) — 「データをインポート」ボタンと全フローのハンドラを追加

依存関係:

- `expo-document-picker` を新規導入 (Expo SDK 54 対応版)

## テスト方針

ユニット (Jest):

- `parseImportJson`: 正常 / 不正な JSON / `version` 不一致 / `entries` が配列でない
- `classifyEntries`: 全パターン (新規 / 重複 / 不正) が正しく振り分けられる、重複検出ロジック
- `bulkUpsertEntries`: 各 strategy (上書き / スキップ / 新しい方) で DB が期待通りの状態になる (既存の better-sqlite3 in-memory テスト基盤を再利用)
- ロールバック: トランザクション中に意図的に例外を起こし、DB が変化していないことを確認

結合 (testing-library/react-native):

- `SettingsScreen` でインポートボタンタップ → モック document-picker 経由で JSON 渡す → モーダル表示 / スキップ → DB 反映の一連の流れ

## 想定エラーと UX

| 状況 | UX |
| --- | --- |
| ユーザーがファイル選択をキャンセル | 何もしない (静かに戻る) |
| 拡張子が json でない / パース失敗 | エラーモーダル「ファイルを読み込めませんでした」 |
| 構造検証失敗 (version 違反など) | エラーモーダル「ファイル形式が一口日記のエクスポートと一致しません」 |
| 全エントリが不正 | 完了通知「取り込めるエントリがありませんでした (K件スキップ)」 |
| トランザクション中の DB 例外 | エラーモーダル「インポートに失敗しました」(ロールバック済み) |
| 正常完了 | 完了通知「N件取り込みました (内訳: 新規X / 上書きY / スキップZ / 不正W)」 |

エラー / 完了通知は既存の `Alert.alert` パターンを踏襲する (`SettingsScreen` の他の操作と一貫させる)。

## YAGNI として今回入れないもの

- スキーマ version 2 以降の処理分岐 (現状 v1 のみ)
- インポート対象範囲の絞り込み (期間指定など) — 全件 or 全件キャンセルの 2択
- インポート前の差分プレビュー (1件ずつ確認するような UI)
- インポート結果の Undo 機能 (アトミックなロールバックは「実行中の失敗時のみ」)
- 複数ファイルの同時取り込み
