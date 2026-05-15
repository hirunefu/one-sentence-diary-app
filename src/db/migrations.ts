// Every statement is idempotent (IF NOT EXISTS), so it's safe to run on
// every launch. Future schema changes will require switching from this
// append-only model to versioned migrations (PRAGMA user_version).
// `date` as PRIMARY KEY enforces "one entry per day" at the DB layer,
// which is what upsertEntry's ON CONFLICT(date) relies on.
// idx_entries_date_desc accelerates the descending scan used by the
// history timeline. (SQLite already indexes the PRIMARY KEY, but a
// dedicated DESC index is cheaper for ORDER BY date DESC range scans.)
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
