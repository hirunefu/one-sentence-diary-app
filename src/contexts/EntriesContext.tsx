import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
  loadDeclinedRepairDay,
  saveDeclinedRepairDay,
} from '../repositories/streakRepairRepository';
import { loadFirstRun, saveFirstRun, type FirstRun } from '../repositories/firstRunRepository';
import {
  acknowledgeImport,
  EMPTY_LEDGER,
  sameLedger,
  seedLedger,
  type CelebrationLedger,
} from '../services/celebration';
import { useToday } from '../hooks/useToday';
import {
  currentStretch,
  streakBreakOf,
  stretchesOf,
  type StreakBreak,
} from '../utils/streak';
import { addDays, isFutureDay, toDateString, today } from '../utils/date';

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
  // The date everything here is computed from; follows midnight and resumes.
  todayStr: string;
  // What Home says about a break, and the Streak repair it can offer.
  streakBreak: StreakBreak;
  // Closes the repair offer for that missing day (kept across restarts).
  declineRepair: (missingDay: string) => void;
  // Where the user is in their first days (repositories/firstRunRepository,
  // ADR 0002). Known before ready; null until then, which shows and asks
  // nothing.
  firstRun: FirstRun | null;
  // A first-time user's first qualifying save on Home starts their first day;
  // its Reminder offer opens unless it could not help.
  startFirstDay: (offer: 'open' | 'closed') => void;
  // Closes the Reminder offer for good. Does nothing unless it is open.
  answerReminderOffer: () => void;
  // After the offer turned Reminders on: Home's confirmation. Session only, so
  // it outlives Home being remounted behind the app lock.
  reminderSetShown: boolean;
  setReminderSetShown: (shown: boolean) => void;
};

const EntriesContext = createContext<EntriesContextValue | null>(null);

// Someone who wrote an Entry on an earlier day already uses the app, whether
// or not a save on Home started their first day (ADR 0002).
const wroteBefore = (list: readonly Entry[], day: string) =>
  list.some((e) => toDateString(new Date(e.createdAt)) < day);

export function EntriesProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DiaryDatabase | null>(null);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [celebrationLedger, setCelebrationLedger] = useState<CelebrationLedger>(EMPTY_LEDGER);
  const ledgerRef = useRef(celebrationLedger);
  const [declinedRepairDay, setDeclinedRepairDay] = useState<string | null>(null);
  const [firstRun, setFirstRun] = useState<FirstRun | null>(null);
  const firstRunRef = useRef<FirstRun | null>(null);
  const [reminderSetShown, setReminderSetShown] = useState(false);
  // Follows the date past midnight and on returning to the app on a later day.
  const todayStr = useToday();
  const todayRef = useRef(todayStr);
  useLayoutEffect(() => {
    todayRef.current = todayStr;
  }, [todayStr]);

  const declineRepair = useCallback((missingDay: string) => {
    setDeclinedRepairDay(missingDay);
    saveDeclinedRepairDay(missingDay).catch((e) => console.error('declined repair save failed', e));
  }, []);

  // Kept in memory at once (also when the save fails) and saved in the background.
  const commitFirstRun = useCallback((next: FirstRun) => {
    firstRunRef.current = next;
    setFirstRun(next);
    saveFirstRun(next).catch((e) => console.error('first run save failed', e));
  }, []);

  const startFirstDay = useCallback(
    (offer: 'open' | 'closed') => {
      if (firstRunRef.current?.kind !== 'new') return;
      commitFirstRun({ kind: 'started', day: todayRef.current, offer });
    },
    [commitFirstRun]
  );

  const answerReminderOffer = useCallback(() => {
    const run = firstRunRef.current;
    if (run?.kind !== 'started' || run.offer !== 'open') return;
    commitFirstRun({ ...run, offer: 'closed' });
  }, [commitFirstRun]);

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
      const [opened, stored, declined, run] = await Promise.all([
        openDatabase(),
        loadCelebrationLedger().catch((e) => {
          console.error('celebration ledger load failed', e);
          return null;
        }),
        // Known before ready, so a declined offer never flashes.
        loadDeclinedRepairDay().catch(() => null),
        loadFirstRun().catch(() => null),
      ]);
      const list = await getAllEntriesDesc(opened);
      setDb(opened);
      setEntries(list);
      setDeclinedRepairDay(declined);
      if (run === null) {
        // First launch of this version, or an unreadable state: whoever already
        // has Entries is not a first-time user (Q19). A missed offer is
        // preferred to a false one, as with the ledger.
        commitFirstRun(list.length > 0 ? { kind: 'returning' } : { kind: 'new' });
      } else if (
        (run.kind === 'started' && run.day < todayRef.current) ||
        (run.kind === 'new' && wroteBefore(list, todayRef.current))
      ) {
        commitFirstRun({ kind: 'returning' });
      } else {
        firstRunRef.current = run;
        setFirstRun(run);
      }
      if (stored) {
        ledgerRef.current = stored;
        setCelebrationLedger(stored);
      } else {
        // First launch, the first launch after an update, or an unreadable
        // ledger: what is already there counts as told.
        commitCelebrationLedger(seedLedger(list.map((e) => e.date), todayRef.current));
      }
      setReady(true);
    } catch (e) {
      console.error('DB init failed', e);
      setInitError('データベースを開けませんでした。アプリを再起動してください。');
    }
  }, [commitCelebrationLedger, commitFirstRun]);

  useEffect(() => {
    init();
  }, [init]);

  // The first day ends at midnight, also while the app stays open, and so does
  // a first-time user's day of writing only from History.
  useEffect(() => {
    if (
      (firstRun?.kind === 'started' && todayStr > firstRun.day) ||
      (firstRun?.kind === 'new' && wroteBefore(entries, todayStr))
    ) {
      commitFirstRun({ kind: 'returning' });
    }
  }, [firstRun, todayStr, entries, commitFirstRun]);

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
      // Deleting yesterday on purpose is not a gap to be offered back.
      if (date === addDays(todayRef.current, -1)) declineRepair(date);
      await refresh(db);
    },
    [db, refresh, declineRepair]
  );

  const bulkImport = useCallback(
    async (
      classified: ClassifiedEntries,
      strategy: ImportStrategy
    ): Promise<ApplyImportResult> => {
      if (!db) throw new Error('DB not ready');
      const datesBefore = await getAllDatesDesc(db);
      const result = await applyImport(db, classified, strategy);
      const list = await getAllEntriesDesc(db);
      setEntries(list);
      // A Streak the import restored was not reached here, so it counts as
      // told. Set in the same batch as the Entries, so no render sees one
      // without the other.
      commitCelebrationLedger(
        acknowledgeImport(datesBefore, list.map((e) => e.date), today(), ledgerRef.current)
      );
      // A restored backup is someone who has used the app before.
      if (result.inserted + result.updated > 0 && firstRunRef.current?.kind !== 'returning') {
        commitFirstRun({ kind: 'returning' });
      }
      return result;
    },
    [db, commitCelebrationLedger, commitFirstRun]
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

  const stretches = useMemo(
    () => stretchesOf(entries.map((e) => e.date), todayStr),
    [entries, todayStr]
  );
  const streak = currentStretch(stretches, todayStr)?.length ?? 0;
  const streakBreak = useMemo(
    () => streakBreakOf(stretches, todayStr, declinedRepairDay),
    [stretches, todayStr, declinedRepairDay]
  );

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
      todayStr,
      streakBreak,
      declineRepair,
      firstRun,
      startFirstDay,
      answerReminderOffer,
      reminderSetShown,
      setReminderSetShown,
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
      todayStr,
      streakBreak,
      declineRepair,
      firstRun,
      startFirstDay,
      answerReminderOffer,
      reminderSetShown,
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
