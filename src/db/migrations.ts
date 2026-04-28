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
