import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, Keyboard } from 'react-native';
import { useEntries } from '../contexts/EntriesContext';
import { STREAK_IN_PLACE_MS } from '../components/StreakDisplay';
import {
  decideCelebration,
  type Celebration,
  type CelebrationLedger,
} from '../services/celebration';
import { useAppActive } from './useAppActive';
import { useReduceMotion } from './useReduceMotion';
import { useScreenReaderEnabled } from './useScreenReaderEnabled';

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

type Showing = { celebration: Celebration; next: CelebrationLedger; told: boolean };

// Home's full-screen celebration of a Milestone or a new Longest streak.
// Decides from the Entries, today and the ledger on every render; shows a due
// celebration only while Home is in front (`enabled`) and the app is active;
// counts it as told once it has been seen (at rest, or closed).
export function useCelebration({ enabled, todayStr }: { enabled: boolean; todayStr: string }): {
  // A celebration is waiting or on screen.
  due: boolean;
  showing: Celebration | null;
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
  const decision = useMemo(
    () => (ready ? decideCelebration(datesKey ? datesKey.split(',') : [], todayStr, ledger) : null),
    [ready, datesKey, todayStr, ledger]
  );

  const [showing, setShowing] = useState<Showing | null>(null);
  const showingRef = useRef(showing);
  useLayoutEffect(() => {
    showingRef.current = showing;
  });

  // A decision that tells nothing (a shrink, midnight, an Entry edited) is
  // acknowledged at once, whether Home is in front or not.
  useEffect(() => {
    if (decision && !decision.celebration) commit(decision.next);
  }, [decision, commit]);

  // A due celebration waits for Home in front and the in-place celebration.
  useEffect(() => {
    if (!enabled || !appActive || showing || !decision?.celebration) return;
    const due = decision;
    const timer = setTimeout(() => {
      Keyboard.dismiss();
      setShowing({ celebration: due.celebration!, next: due.next, told: false });
    }, revealDelayMs({ reduceMotion, screenReader }));
    // Leaving Home, the background, a lock or a newer state: nothing is told.
    return () => clearTimeout(timer);
  }, [enabled, appActive, showing, decision, reduceMotion, screenReader]);

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

  // The backup reminder must not open over the celebration.
  const busy = showing !== null || !!decision?.celebration;
  const busyRef = useRef(busy);
  useLayoutEffect(() => {
    busyRef.current = busy;
  });
  const queue = useRef<Array<() => void>>([]);
  const afterCelebration = useCallback((fn: () => void) => {
    if (busyRef.current) queue.current.push(fn);
    else fn();
  }, []);
  useEffect(() => {
    if (busy || queue.current.length === 0) return;
    const timer = setTimeout(() => {
      const queued = queue.current;
      queue.current = [];
      queued.forEach((fn) => fn());
    }, AFTER_CLOSE_PAUSE_MS);
    // Dropped on unmount: the reminder records nothing until it is shown, so
    // the next save reminds again.
    return () => clearTimeout(timer);
  }, [busy]);

  return {
    due: busy,
    showing: showing?.celebration ?? null,
    settled,
    close,
    afterCelebration,
  };
}
