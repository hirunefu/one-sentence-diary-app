import Database from 'better-sqlite3';
import type { DiaryDatabase } from './database';
import { runMigrations } from './migrations';

export async function openTestDatabase(): Promise<DiaryDatabase> {
  const db = new Database(':memory:');

  const wrapped: DiaryDatabase = {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, params) {
      const stmt = db.prepare(sql);
      const result = stmt.run(...(params ?? []));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: result.changes,
      };
    },
    async getAllAsync<T>(sql: string, params?: ReadonlyArray<string | number | null>) {
      return db.prepare(sql).all(...(params ?? [])) as T[];
    },
    async getFirstAsync<T>(sql: string, params?: ReadonlyArray<string | number | null>) {
      const row = db.prepare(sql).get(...(params ?? []));
      return (row ?? null) as T | null;
    },
    async closeAsync() {
      db.close();
    },
  };

  await runMigrations((sql) => wrapped.execAsync(sql));
  return wrapped;
}
