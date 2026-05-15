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
  // `date` is stored as an ISO 8601 string, so lexicographic order equals
  // chronological order. Using "-31" as the upper bound is safe even for
  // months without a 31st — nonexistent dates simply don't exist in the
  // table, so string comparison won't over-match (e.g. 2024-02-30).
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

// Import is all-or-nothing: wrap everything in a transaction so a mid-stream
// failure rolls back cleanly. Without it, a retry under the 'skip' strategy
// would leave already-inserted rows untouched while skipping conflicts,
// producing an inconsistent state the user can't easily reconcile.
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
