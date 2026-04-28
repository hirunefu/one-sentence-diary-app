import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { DiaryDatabase } from '../db/database';
import { openDatabase } from '../db/database';
import type { Entry } from '../types';
import {
  upsertEntry as repoUpsert,
  getEntryByDate as repoGetByDate,
  deleteEntry as repoDelete,
  getAllEntriesDesc,
  getDatesInMonth as repoDatesInMonth,
  getAllDatesDesc,
} from '../repositories/entriesRepository';
import { calculateStreak } from '../utils/streak';
import { today } from '../utils/date';

type EntriesContextValue = {
  ready: boolean;
  initError: string | null;
  retryInit: () => Promise<void>;
  entries: Entry[];
  streak: number;
  upsert: (date: string, text: string) => Promise<void>;
  remove: (date: string) => Promise<void>;
  getByDate: (date: string) => Promise<Entry | null>;
  getDatesInMonth: (year: number, month: number) => Promise<string[]>;
};

const EntriesContext = createContext<EntriesContextValue | null>(null);

export function EntriesProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DiaryDatabase | null>(null);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);

  const init = useCallback(async () => {
    setInitError(null);
    setReady(false);
    try {
      const opened = await openDatabase();
      const list = await getAllEntriesDesc(opened);
      setDb(opened);
      setEntries(list);
      setReady(true);
    } catch (e) {
      console.error('DB init failed', e);
      setInitError('データベースを開けませんでした。アプリを再起動してください。');
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  const refresh = useCallback(async (currentDb: DiaryDatabase) => {
    const list = await getAllEntriesDesc(currentDb);
    setEntries(list);
  }, []);

  const upsert = useCallback(
    async (date: string, text: string) => {
      if (!db) throw new Error('DB not ready');
      await repoUpsert(db, { date, text, now: Date.now() });
      await refresh(db);
    },
    [db, refresh]
  );

  const remove = useCallback(
    async (date: string) => {
      if (!db) throw new Error('DB not ready');
      await repoDelete(db, date);
      await refresh(db);
    },
    [db, refresh]
  );

  const getByDate = useCallback(
    async (date: string) => {
      if (!db) return null;
      return repoGetByDate(db, date);
    },
    [db]
  );

  const getDatesInMonth = useCallback(
    async (year: number, month: number) => {
      if (!db) return [];
      return repoDatesInMonth(db, year, month);
    },
    [db]
  );

  const streak = useMemo(() => {
    const dates = entries.map((e) => e.date);
    return calculateStreak(dates, today());
  }, [entries]);

  const value = useMemo(
    () => ({
      ready,
      initError,
      retryInit: init,
      entries,
      streak,
      upsert,
      remove,
      getByDate,
      getDatesInMonth,
    }),
    [ready, initError, init, entries, streak, upsert, remove, getByDate, getDatesInMonth]
  );

  return (
    <EntriesContext.Provider value={value}>{children}</EntriesContext.Provider>
  );
}

export function useEntries(): EntriesContextValue {
  const v = useContext(EntriesContext);
  if (!v) throw new Error('useEntries must be used within EntriesProvider');
  return v;
}
