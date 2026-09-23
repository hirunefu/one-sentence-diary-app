import type { DiaryDatabase } from './database';

// expo-sqlite is a native module, so this is the system boundary we fake.
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

function fakeSQLiteDatabase() {
  return {
    execAsync: jest.fn(async () => {}),
    runAsync: jest.fn(async () => ({ lastInsertRowId: 0, changes: 0 })),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
    closeAsync: jest.fn(async () => {}),
  };
}

describe('openDatabase', () => {
  let openDatabase: () => Promise<DiaryDatabase>;
  let openDatabaseAsync: jest.Mock;

  beforeEach(() => {
    // Each test gets a fresh module instance, i.e. a fresh JS runtime's view
    // of src/db/database.ts.
    jest.resetModules();
    openDatabaseAsync = require('expo-sqlite').openDatabaseAsync;
    openDatabaseAsync.mockImplementation(async () => fakeSQLiteDatabase());
    openDatabase = require('./database').openDatabase;
  });

  test('同じ JS ランタイムで何度開いても同じデータベースを返す', async () => {
    const first = await openDatabase();
    const second = await openDatabase();
    expect(second).toBe(first);
  });

  test('開くのに失敗しても次の呼び出しで開き直せる', async () => {
    openDatabaseAsync.mockRejectedValueOnce(new Error('disk I/O error'));
    await expect(openDatabase()).rejects.toThrow('disk I/O error');

    const db = await openDatabase();
    await expect(db.getAllAsync('SELECT * FROM entries')).resolves.toEqual([]);
  });
});
