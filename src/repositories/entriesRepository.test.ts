import { openTestDatabase } from '../db/testDatabase';
import type { DiaryDatabase } from '../db/database';
import {
  upsertEntry,
  getEntryByDate,
  deleteEntry,
  getAllEntriesDesc,
  getDatesInMonth,
  getAllDatesDesc,
  bulkUpsertEntries,
} from './entriesRepository';

describe('entriesRepository', () => {
  let db: DiaryDatabase;

  beforeEach(async () => {
    db = await openTestDatabase();
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  test('upsert then getByDate returns the entry', async () => {
    await upsertEntry(db, { date: '2026-04-28', text: 'hello', now: 1000 });
    const e = await getEntryByDate(db, '2026-04-28');
    expect(e).toEqual({
      date: '2026-04-28',
      text: 'hello',
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  test('getByDate returns null when no entry', async () => {
    const e = await getEntryByDate(db, '2026-04-28');
    expect(e).toBeNull();
  });

  test('upsert overwrites text and updates updatedAt but keeps createdAt', async () => {
    await upsertEntry(db, { date: '2026-04-28', text: 'first', now: 1000 });
    await upsertEntry(db, { date: '2026-04-28', text: 'second', now: 2000 });
    const e = await getEntryByDate(db, '2026-04-28');
    expect(e).toEqual({
      date: '2026-04-28',
      text: 'second',
      createdAt: 1000,
      updatedAt: 2000,
    });
  });

  test('deleteEntry removes the entry', async () => {
    await upsertEntry(db, { date: '2026-04-28', text: 'hello', now: 1000 });
    await deleteEntry(db, '2026-04-28');
    expect(await getEntryByDate(db, '2026-04-28')).toBeNull();
  });

  test('getAllEntriesDesc returns entries newest first', async () => {
    await upsertEntry(db, { date: '2026-04-26', text: 'a', now: 1000 });
    await upsertEntry(db, { date: '2026-04-28', text: 'c', now: 1000 });
    await upsertEntry(db, { date: '2026-04-27', text: 'b', now: 1000 });
    const list = await getAllEntriesDesc(db);
    expect(list.map((e) => e.date)).toEqual(['2026-04-28', '2026-04-27', '2026-04-26']);
  });

  test('getDatesInMonth returns only dates within the month', async () => {
    await upsertEntry(db, { date: '2026-03-31', text: 'a', now: 1000 });
    await upsertEntry(db, { date: '2026-04-01', text: 'b', now: 1000 });
    await upsertEntry(db, { date: '2026-04-15', text: 'c', now: 1000 });
    await upsertEntry(db, { date: '2026-04-30', text: 'd', now: 1000 });
    await upsertEntry(db, { date: '2026-05-01', text: 'e', now: 1000 });
    const dates = await getDatesInMonth(db, 2026, 4);
    expect(dates.sort()).toEqual(['2026-04-01', '2026-04-15', '2026-04-30']);
  });

  test('getAllDatesDesc returns date strings newest first', async () => {
    await upsertEntry(db, { date: '2026-04-26', text: 'a', now: 1000 });
    await upsertEntry(db, { date: '2026-04-28', text: 'c', now: 1000 });
    const dates = await getAllDatesDesc(db);
    expect(dates).toEqual(['2026-04-28', '2026-04-26']);
  });
});

describe('bulkUpsertEntries', () => {
  let db: DiaryDatabase;
  beforeEach(async () => {
    db = await openTestDatabase();
  });
  afterEach(async () => {
    await db.closeAsync();
  });

  test('strategy=overwrite で新規と重複の両方を反映', async () => {
    await upsertEntry(db, { date: '2026-04-29', text: 'old', now: 1000 });
    const result = await bulkUpsertEntries(
      db,
      [{ date: '2026-04-30', text: 'new', createdAt: 2000, updatedAt: 2000 }],
      [{ date: '2026-04-29', text: 'imported', createdAt: 500, updatedAt: 3000 }],
      'overwrite'
    );
    expect(result).toEqual({ inserted: 1, updated: 1, skipped: 0 });
    expect(await getEntryByDate(db, '2026-04-29')).toEqual({
      date: '2026-04-29',
      text: 'imported',
      createdAt: 500,
      updatedAt: 3000,
    });
    expect(await getEntryByDate(db, '2026-04-30')).toEqual({
      date: '2026-04-30',
      text: 'new',
      createdAt: 2000,
      updatedAt: 2000,
    });
  });

  test('strategy=skip で重複は変更されない', async () => {
    await upsertEntry(db, { date: '2026-04-29', text: 'old', now: 1000 });
    const result = await bulkUpsertEntries(
      db,
      [{ date: '2026-04-30', text: 'new', createdAt: 2000, updatedAt: 2000 }],
      [{ date: '2026-04-29', text: 'imported', createdAt: 500, updatedAt: 3000 }],
      'skip'
    );
    expect(result).toEqual({ inserted: 1, updated: 0, skipped: 1 });
    expect(await getEntryByDate(db, '2026-04-29')).toEqual({
      date: '2026-04-29',
      text: 'old',
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  test('strategy=newer でインポートが新しければ更新、古ければスキップ', async () => {
    await upsertEntry(db, { date: '2026-04-28', text: 'older', now: 1000 });
    await upsertEntry(db, { date: '2026-04-29', text: 'newer', now: 5000 });
    const result = await bulkUpsertEntries(
      db,
      [],
      [
        { date: '2026-04-28', text: 'i-newer', createdAt: 1, updatedAt: 3000 },
        { date: '2026-04-29', text: 'i-older', createdAt: 1, updatedAt: 2000 },
      ],
      'newer'
    );
    expect(result).toEqual({ inserted: 0, updated: 1, skipped: 1 });
    expect((await getEntryByDate(db, '2026-04-28'))?.text).toBe('i-newer');
    expect((await getEntryByDate(db, '2026-04-29'))?.text).toBe('newer');
  });

  test('strategy=newer で同じ updatedAt はスキップ (>=)', async () => {
    await upsertEntry(db, { date: '2026-04-28', text: 'old', now: 1000 });
    const result = await bulkUpsertEntries(
      db,
      [],
      [{ date: '2026-04-28', text: 'imported', createdAt: 1, updatedAt: 1000 }],
      'newer'
    );
    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
    expect((await getEntryByDate(db, '2026-04-28'))?.text).toBe('old');
  });

  test('空配列を渡しても動作する', async () => {
    const result = await bulkUpsertEntries(db, [], [], 'overwrite');
    expect(result).toEqual({ inserted: 0, updated: 0, skipped: 0 });
  });

  test('途中で例外が出たら全件ロールバックされる', async () => {
    await upsertEntry(db, { date: '2026-04-29', text: 'old', now: 1000 });
    await expect(
      bulkUpsertEntries(
        db,
        [
          { date: '2026-04-30', text: 'a', createdAt: 1, updatedAt: 1 },
          { date: '2026-04-30', text: 'b', createdAt: 1, updatedAt: 1 },
        ],
        [],
        'overwrite'
      )
    ).rejects.toThrow();
    expect(await getEntryByDate(db, '2026-04-30')).toBeNull();
    expect((await getEntryByDate(db, '2026-04-29'))?.text).toBe('old');
  });
});
