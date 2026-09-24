import AsyncStorage from '@react-native-async-storage/async-storage';

// The missing day whose Streak repair offer was closed. App state, not diary
// data: out of SQLite, the settings and the export JSON, like the celebration
// ledger. A later decline overwrites it; an old day simply stops matching.
const KEY = 'streakRepair.declinedDay';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function loadDeclinedRepairDay(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw !== null && DATE_RE.test(raw) ? raw : null;
}

export async function saveDeclinedRepairDay(day: string): Promise<void> {
  await AsyncStorage.setItem(KEY, day);
}
