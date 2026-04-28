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
