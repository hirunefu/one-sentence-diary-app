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

// One connection per JS runtime. On Android, leaving with Back finishes the
// activity but keeps the process and its JS runtime, and the next launch
// mounts the React tree again. Opening diary.db a second time would get
// expo-sqlite's cached native connection behind a second JS wrapper; once the
// first wrapper is garbage collected it closes that shared connection, and
// every later query fails.
let opening: Promise<DiaryDatabase> | null = null;

export function openDatabase(): Promise<DiaryDatabase> {
  if (!opening) {
    // Don't cache a failure, so the retry on the Home screen really retries.
    opening = openConnection().catch((e: unknown) => {
      opening = null;
      throw e;
    });
  }
  return opening;
}

async function openConnection(): Promise<DiaryDatabase> {
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
