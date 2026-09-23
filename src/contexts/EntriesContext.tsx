import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  type ImportStrategy,
} from '../repositories/entriesRepository';
import {
  applyImport,
  type ClassifiedEntries,
  type ApplyImportResult,
} from '../services/importService';
import {
  loadCelebrationLedger,
  saveCelebrationLedger,
} from '../repositories/celebrationRepository';
import {
  acknowledge,
  EMPTY_LEDGER,
  sameLedger,
  type CelebrationLedger,
} from '../services/celebration';
import { calculateStreak } from '../utils/streak';
import { isFutureDay, today } from '../utils/date';

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
  bulkImport: (
    classified: ClassifiedEntries,
    strategy: ImportStrategy
  ) => Promise<ApplyImportResult>;
  // What the user has already been told about their Streak (services/celebration).
  // Loaded with the Entries, so it is ready whenever `ready` is.
  celebrationLedger: CelebrationLedger;
  // Keeps it in memory at once and saves it in the background.
  commitCelebrationLedger: (next: CelebrationLedger) => void;
};

const EntriesContext = createContext<EntriesContextValue | null>(null);

export function EntriesProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DiaryDatabase | null>(null);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [celebrationLedger, setCelebrationLedger] = useState<CelebrationLedger>(EMPTY_LEDGER);
  const ledgerRef = useRef(celebrationLedger);

  const commitCelebrationLedger = useCallback((next: CelebrationLedger) => {
    if (sameLedger(next, ledgerRef.current)) return;
    ledgerRef.current = next;
    setCelebrationLedger(next);
    saveCelebrationLedger(next).catch((e) => console.error('celebration ledger save failed', e));
  }, []);

  const init = useCallback(async () => {
    setInitError(null);
    setReady(false);
    try {
      const [opened, stored] = await Promise.all([
        openDatabase(),
        loadCelebrationLedger().catch((e) => {
          console.error('celebration ledger load failed', e);
          return null;
        }),
      ]);
      const list = await getAllEntriesDesc(opened);
      setDb(opened);
      setEntries(list);
      if (stored) {
        ledgerRef.current = stored;
        setCelebrationLedger(stored);
      } else {
        // First launch, the first launch after an update, or an unreadable
        // ledger: the Streak already there counts as told.
        commitCelebrationLedger(acknowledge(list.map((e) => e.date), today(), EMPTY_LEDGER));
      }
      setReady(true);
    } catch (e) {
      console.error('DB init failed', e);
      setInitError('データベースを開けませんでした。アプリを再起動してください。');
    }
  }, [commitCelebrationLedger]);

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
      if (isFutureDay(date, today())) {
        throw new Error(`Cannot write an Entry for a future day: ${date}`);
      }
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

  const bulkImport = useCallback(
    async (
      classified: ClassifiedEntries,
      strategy: ImportStrategy
    ): Promise<ApplyImportResult> => {
      if (!db) throw new Error('DB not ready');
      const result = await applyImport(db, classified, strategy);
      const list = await getAllEntriesDesc(db);
      setEntries(list);
      // A restored Streak was not reached here, so it counts as told. Set in
      // the same batch as the Entries, so no render sees one without the other.
      commitCelebrationLedger(acknowledge(list.map((e) => e.date), today(), ledgerRef.current));
      return result;
    },
    [db, commitCelebrationLedger]
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
      bulkImport,
      celebrationLedger,
      commitCelebrationLedger,
    }),
    [
      ready,
      initError,
      init,
      entries,
      streak,
      upsert,
      remove,
      getByDate,
      getDatesInMonth,
      bulkImport,
      celebrationLedger,
      commitCelebrationLedger,
    ]
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
