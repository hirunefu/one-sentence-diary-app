import { openTestDatabase } from '../db/testDatabase';
import type { DiaryDatabase } from '../db/database';
import {
  upsertEntry,
  getEntryByDate,
  deleteEntry,
  getAllEntriesDesc,
  getDatesInMonth,
  getAllDatesDesc,
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
