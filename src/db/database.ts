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
