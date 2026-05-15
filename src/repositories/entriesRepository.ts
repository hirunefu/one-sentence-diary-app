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
  // date は ISO 8601 形式の文字列で格納されているため、辞書順 = 時系列順。
  // 終端を一律 "-31" にしても、その月に 31 日が存在しなくても
  // 文字列比較で過剰一致しない (例: 2024-02-30 が存在しないので拾わない)。
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

// インポートは「全件成功」か「全件ロールバック」のいずれかを保証する。
// 途中で失敗した場合に半端な状態で DB が残ると、ユーザーが再インポートしても
// 'skip' 戦略では既に入った部分が上書きされず矛盾するため、トランザクションで包む。
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
