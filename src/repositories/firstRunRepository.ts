import AsyncStorage from '@react-native-async-storage/async-storage';

// Where this device's user is in their first days: Home's first-run lines and
// the one Reminder offer (ADR 0002). App state, not diary data: out of SQLite,
// the settings and the export JSON, like the celebration ledger.
const KEY = 'firstRun.state';
const VERSION = 1;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type FirstRun =
  // Had Entries when this version first opened, imported a backup, or is past
  // their first day on Home: Home is the everyday Home, for good.
  | { kind: 'returning' }
  // A first-time user whose first day on Home has not started.
  | { kind: 'new' }
  // The day of a first-time user's first save on Home, and whether its
  // Reminder offer is still open.
  | { kind: 'started'; day: string; offer: 'open' | 'closed' };

// null: nothing stored, or something unreadable.
export async function loadFirstRun(): Promise<FirstRun | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const o = v as Record<string, unknown>;
    if (o.v !== VERSION) return null;
    if (o.kind === 'returning' || o.kind === 'new') return { kind: o.kind };
    if (
      o.kind === 'started' &&
      typeof o.day === 'string' &&
      DATE_RE.test(o.day) &&
      (o.offer === 'open' || o.offer === 'closed')
    ) {
      return { kind: 'started', day: o.day, offer: o.offer };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveFirstRun(state: FirstRun): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ v: VERSION, ...state }));
}
