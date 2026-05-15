// 各文は冪等 (IF NOT EXISTS) なので、起動時に毎回流して問題ない。
// 将来スキーマ変更が必要になったら、ここを「追記専用」ではなく
// バージョン管理付きマイグレーション (PRAGMA user_version) に作り直す必要がある。
// date を PRIMARY KEY に置くことで「1 日 1 エントリ」を DB レベルで保証し、
// upsertEntry の ON CONFLICT(date) が機能する。
// idx_entries_date_desc は履歴タイムラインの DESC スキャンを高速化するため。
// (SQLite は PRIMARY KEY からも索引を作るが、DESC 専用の別索引のほうが
//  ORDER BY date DESC のレンジスキャンを安価にこなせる)
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
