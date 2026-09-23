import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MAX_REMEMBERED_STRETCHES,
  type CelebrationLedger,
  type StretchMemory,
} from '../services/celebration';
import { isMilestone } from '../utils/milestone';
import type { Stretch } from '../utils/streak';

// What the user has already been told. App state, not diary data: it stays out
// of the export JSON and out of the settings, like the backup reminder's state.
// See docs/adr/0001-celebration-ledger.md.
const KEY = 'celebration.ledger';
const VERSION = 1;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null;
const isCount = (v: unknown, min: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min;
const isRange = (v: Json) =>
  typeof v.start === 'string' &&
  typeof v.end === 'string' &&
  DATE_RE.test(v.start) &&
  DATE_RE.test(v.end) &&
  v.start <= v.end;

function parseStretch(v: unknown): Stretch | null | undefined {
  if (v === null) return null;
  if (!isObject(v) || !isRange(v) || !isCount(v.length, 1)) return undefined;
  return { start: v.start as string, end: v.end as string, length: v.length };
}

function parseMemory(v: unknown): StretchMemory | undefined {
  if (!isObject(v) || !isRange(v) || !isCount(v.held, 0)) return undefined;
  const milestone = v.milestone;
  if (!isCount(milestone, 0) || (milestone !== 0 && !isMilestone(milestone))) return undefined;
  return { start: v.start as string, end: v.end as string, milestone, held: v.held };
}

// null when missing or unreadable in any way: the caller then seeds it.
export async function loadCelebrationLedger(): Promise<CelebrationLedger | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === null) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(v) || v.v !== VERSION || !Array.isArray(v.stretches)) return null;
  if (v.stretches.length > MAX_REMEMBERED_STRETCHES) return null;
  const stretches = v.stretches.map(parseMemory);
  const seen = parseStretch(v.seen);
  const longest = parseStretch(v.longest);
  if (stretches.some((m) => m === undefined) || seen === undefined || longest === undefined) {
    return null;
  }
  return { stretches: stretches as StretchMemory[], seen, longest };
}

export async function saveCelebrationLedger(ledger: CelebrationLedger): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ v: VERSION, ...ledger }));
}
