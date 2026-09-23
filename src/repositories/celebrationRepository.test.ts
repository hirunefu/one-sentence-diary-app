import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadCelebrationLedger, saveCelebrationLedger } from './celebrationRepository';
import type { CelebrationLedger } from '../services/celebration';

const KEY = 'celebration.ledger';

const ledger: CelebrationLedger = {
  stretches: [{ start: '2026-05-09', end: '2026-05-15', milestone: 7, held: 7 }],
  seen: { start: '2026-05-09', end: '2026-05-15', length: 7 },
  longest: { start: '2026-05-09', end: '2026-05-15', length: 7 },
};

const stored = (over: Record<string, unknown>) => JSON.stringify({ v: 1, ...ledger, ...over });

describe('celebrationRepository', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('has no ledger before one is saved', async () => {
    expect(await loadCelebrationLedger()).toBeNull();
  });

  test('round-trips a ledger', async () => {
    await saveCelebrationLedger(ledger);
    expect(await loadCelebrationLedger()).toEqual(ledger);
  });

  test('round-trips an empty ledger', async () => {
    const empty: CelebrationLedger = { stretches: [], seen: null, longest: null };
    await saveCelebrationLedger(empty);
    expect(await loadCelebrationLedger()).toEqual(empty);
  });

  // Anything unreadable loads as missing, so the app seeds it silently: at
  // worst a celebration is missed, never a false one shown.
  test.each([
    ['broken JSON', '{'],
    ['another version', stored({ v: 2 })],
    ['a bad date', stored({ seen: { start: '2026-5-9', end: '2026-05-15', length: 7 } })],
    ['start after end', stored({ seen: { start: '2026-05-16', end: '2026-05-15', length: 7 } })],
    ['a length of 0', stored({ longest: { start: '2026-05-09', end: '2026-05-15', length: 0 } })],
    [
      'a Milestone that is not one',
      stored({ stretches: [{ start: '2026-05-09', end: '2026-05-15', milestone: 8, held: 7 }] }),
    ],
    [
      'a negative held',
      stored({ stretches: [{ start: '2026-05-09', end: '2026-05-15', milestone: 7, held: -1 }] }),
    ],
    ['too many stretches', stored({ stretches: Array(9).fill(ledger.stretches[0]) })],
    ['no stretches field', JSON.stringify({ v: 1, seen: null, longest: null })],
  ])('loads %s as missing', async (_, raw) => {
    await AsyncStorage.setItem(KEY, raw);
    expect(await loadCelebrationLedger()).toBeNull();
  });
});
