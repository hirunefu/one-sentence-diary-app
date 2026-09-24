import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, Keyboard } from 'react-native';
import { useEntries } from '../contexts/EntriesContext';
import { STREAK_IN_PLACE_MS } from '../components/StreakDisplay';
import {
  decideCelebration,
  type CelebrationLedger,
  type MilestoneCelebration,
} from '../services/celebration';
import { useAppActive } from './useAppActive';
import { useReduceMotion } from './useReduceMotion';
import { useScreenReaderEnabled } from './useScreenReaderEnabled';
import { calculateStreak } from '../utils/streak';

// A short breath between the in-place celebration landing and the full screen.
export const REVEAL_PAUSE_MS = 200;
// Between closing the celebration and anything queued behind it.
export const AFTER_CLOSE_PAUSE_MS = 400;

// How long a due celebration waits after Home shows the new Streak.
export function revealDelayMs(o: { reduceMotion: boolean; screenReader: boolean }): number {
  // Lets TalkBack finish "保存しました" before focus moves to the celebration.
  if (o.screenReader) return 1400;
  // Nothing moves in place; the pause itself is not motion.
  if (o.reduceMotion) return 500;
  return STREAK_IN_PLACE_MS + REVEAL_PAUSE_MS;
}

type Showing = { celebration: MilestoneCelebration; next: CelebrationLedger; told: boolean };

// A new Longest streak on a day that is not a Milestone: told by a quiet line
// on Home rather than the full screen, which stays for Milestones.
export type LongestToday = {
  // One per stretch and length, to announce it once.
  key: string;
  streak: number;
  previousLongest: number;
};

// Home's celebrations: the full screen for a Milestone, a quiet line for a new
// Longest streak alone. Decides from the Entries, today and the ledger on every
// render; shows a due celebration only while Home is in front (`enabled`) and
// the app is active; counts it as told once it has been seen (the full screen
// at rest or closed, the line shown).
export function useCelebration({ enabled, todayStr }: { enabled: boolean; todayStr: string }): {
  // A full-screen celebration is waiting or on screen.
  due: boolean;
  showing: MilestoneCelebration | null;
  // A new Longest streak alone, decided but not yet shown.
  longestDue: LongestToday | null;
  // A new Longest streak alone, shown on Home for the rest of the day.
  longestToday: LongestToday | null;
  // The entrance came to rest.
  settled: () => void;
  // Closed with 閉じる or Back.
  close: () => void;
  // Runs `fn` now, or after the celebration when one is due.
  afterCelebration: (fn: () => void) => void;
} {
  const {
    ready,
    entries,
    celebrationLedger: ledger,
    commitCelebrationLedger: commit,
  } = useEntries();
  const reduceMotion = useReduceMotion();
  const screenReader = useScreenReaderEnabled();
  const appActive = useAppActive();

  // Stable while only an Entry's text changes, so saving today's Entry again
  // does not restart the pause.
  const datesKey = useMemo(() => entries.map((e) => e.date).join(','), [entries]);
  const dates = useMemo(() => (datesKey ? datesKey.split(',') : []), [datesKey]);
  const decision = useMemo(
    () => (ready ? decideCelebration(dates, todayStr, ledger) : null),
    [ready, dates, todayStr, ledger]
  );

  const due = decision?.celebration ?? null;
  const milestoneDue = due && due.milestone !== null ? (due as MilestoneCelebration) : null;
  const longestDue = useMemo<LongestToday | null>(
    () =>
      due && due.milestone === null && due.previousLongest !== null
        ? {
            key: `${due.stretchStart}@${due.streak}`,
            streak: due.streak,
            previousLongest: due.previousLongest,
          }
        : null,
    [due]
  );

  const [showing, setShowing] = useState<Showing | null>(null);
  const [longestToday, setLongestToday] = useState<(LongestToday & { date: string }) | null>(null);
  const showingRef = useRef(showing);
  useLayoutEffect(() => {
    showingRef.current = showing;
  });

  // A decision that tells nothing (a shrink, midnight, an Entry edited) is
  // acknowledged at once, whether Home is in front or not.
  useEffect(() => {
    if (decision && !decision.celebration) commit(decision.next);
  }, [decision, commit]);

  // A due Milestone waits for Home in front and the in-place celebration.
  useEffect(() => {
    if (!enabled || !appActive || showing || !milestoneDue || !decision) return;
    const { next } = decision;
    const timer = setTimeout(() => {
      Keyboard.dismiss();
      setShowing({ celebration: milestoneDue, next, told: false });
    }, revealDelayMs({ reduceMotion, screenReader }));
    // Leaving Home, the background, a lock or a newer state: nothing is told.
    return () => clearTimeout(timer);
  }, [enabled, appActive, showing, milestoneDue, decision, reduceMotion, screenReader]);

  // A new Longest streak alone joins the in-place celebration once the number
  // has settled; being shown on Home in the foreground counts as told.
  useEffect(() => {
    if (!enabled || !appActive || !longestDue || !decision) return;
    const { next } = decision;
    const timer = setTimeout(
      () => {
        setLongestToday({ ...longestDue, date: todayStr });
        commit(next);
      },
      reduceMotion ? 0 : STREAK_IN_PLACE_MS
    );
    return () => clearTimeout(timer);
  }, [enabled, appActive, longestDue, decision, todayStr, reduceMotion, commit]);

  // Home left while it is showing (only by navigation from code, since it
  // covers the tabs): hide it. If not yet told, it stays due.
  useEffect(() => {
    if (!enabled && showing) setShowing(null);
  }, [enabled, showing]);

  const tell = useCallback(() => {
    const current = showingRef.current;
    if (!current || current.told) return;
    commit(current.next);
    const told = { ...current, told: true };
    showingRef.current = told;
    setShowing(told);
  }, [commit]);

  const settled = useCallback(() => {
    // A native entrance can finish while the app is in the background.
    if (AppState.currentState !== 'background') tell();
  }, [tell]);

  const close = useCallback(() => {
    tell();
    showingRef.current = null;
    setShowing(null);
  }, [tell]);

  // The backup reminder must not open over the full screen. The quiet line
  // stays on Home, so it holds nothing back.
  const busy = showing !== null || milestoneDue !== null;
  const busyRef = useRef(busy);
  useLayoutEffect(() => {
    busyRef.current = busy;
  });
  // One slot, latest wins: two saves behind one celebration remind once.
  const pending = useRef<(() => void) | null>(null);
  const afterCelebration = useCallback((fn: () => void) => {
    if (busyRef.current) pending.current = fn;
    else fn();
  }, []);
  useEffect(() => {
    if (busy || !pending.current) return;
    const timer = setTimeout(() => {
      const queued = pending.current;
      pending.current = null;
      queued?.();
    }, AFTER_CLOSE_PAUSE_MS);
    // Dropped on unmount: the reminder records nothing until it is shown, so
    // the next save reminds again.
    return () => clearTimeout(timer);
  }, [busy]);

  return {
    due: busy,
    showing: showing?.celebration ?? null,
    longestDue,
    // Only for the day it was told on, and while it is still true.
    longestToday:
      longestToday &&
      longestToday.date === todayStr &&
      calculateStreak(dates, todayStr) >= longestToday.streak
        ? longestToday
        : null,
    settled,
    close,
    afterCelebration,
  };
}
