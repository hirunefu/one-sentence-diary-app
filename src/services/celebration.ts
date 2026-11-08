import { highestMilestoneAtMost } from '../utils/milestone';
import {
  currentStretch,
  holderOf,
  longestStreak,
  stretchesOf,
  type Stretch,
} from '../utils/streak';

// Decides when the Streak earns a full celebration: reaching a Milestone, or
// passing a previous Longest streak of at least LONGEST_FLOOR days. Pure: the
// app keeps the ledger (what has already been told) and hands it back in.
//
// Each Milestone is told once per stretch, and only when the Streak grew since
// the last acknowledgement, so deleting and rewriting an Entry, a restart or an
// import never tells anything twice, while a real break lets 3, 7, ... be told
// again. A stretch that loses days keeps its identity in its oldest surviving
// part (see continuationOf). Why a ledger at all: docs/adr/0001-celebration-ledger.md.

export type StretchMemory = {
  start: string;
  end: string;
  // The highest Milestone told for this stretch, or taken as told (seeding,
  // imports, a stretch that shrank past it).
  milestone: number;
  // The greatest length at which this stretch alone held the Longest streak.
  // Only grows, so a tie or a split cannot hand the record back and tell it again.
  held: number;
};

export type CelebrationLedger = {
  // Newest end first, at most MAX_REMEMBERED_STRETCHES. Memories that carry
  // nothing are not kept. What lives on in the stretch just before the Streak
  // is kept before the rest, so a Streak repair finds what it told. When full,
  // the least telling memory goes first.
  stretches: readonly StretchMemory[];
  // The Streak's stretch at the last acknowledgement.
  seen: Stretch | null;
  // The stretch holding the Longest streak at the last acknowledgement.
  longest: Stretch | null;
};

export type Celebration = {
  stretchStart: string;
  // The current Streak.
  streak: number;
  // The highest Milestone reached and not yet told, if any.
  milestone: number | null;
  // The Longest streak the Streak just passed, if it is to be told.
  previousLongest: number | null;
};

// Told on the full screen. A new Longest streak alone (milestone null) is told
// in place on Home instead.
export type MilestoneCelebration = Celebration & { milestone: number };

export type CelebrationDecision = { celebration: Celebration | null; next: CelebrationLedger };

export const EMPTY_LEDGER: CelebrationLedger = { stretches: [], seen: null, longest: null };
export const LONGEST_FLOOR = 7;
export const MAX_REMEMBERED_STRETCHES = 8;

type Range = { start: string; end: string };

const overlaps = (a: Range, b: Range) => a.start <= b.end && b.start <= a.end;
const byEndDesc = (a: Range, b: Range) => (a.end < b.end ? 1 : a.end > b.end ? -1 : 0);
const byImportance = (a: StretchMemory, b: StretchMemory) =>
  b.milestone - a.milestone || b.held - a.held || byEndDesc(a, b);
const carries = (m: StretchMemory) => m.milestone > 0 || m.held > 0;
const max0 = (values: number[]) => values.reduce((a, v) => Math.max(a, v), 0);
const asStretch = (s: Stretch | null): Stretch | null =>
  s ? { start: s.start, end: s.end, length: s.length } : null;

// The stretch a remembered one lives on in: the oldest current stretch that
// still has one of its days. Deleting today's Entry or the first days keeps
// the identity; a gap in the middle leaves the part after it as a new stretch.
function continuationOf(memory: Range, stretches: readonly Stretch[]): Stretch | null {
  for (let i = stretches.length - 1; i >= 0; i--) {
    if (overlaps(memory, stretches[i]!)) return stretches[i]!;
  }
  return null;
}

function inheritedBy(
  stretch: Stretch,
  stretches: readonly Stretch[],
  ledger: CelebrationLedger
): StretchMemory[] {
  return ledger.stretches.filter((m) => continuationOf(m, stretches) === stretch);
}

// `keep` marks memories that hold their place like those of the stretch before
// the Streak (an import works on frames that cannot see the recent stretches).
function acknowledgeStretches(
  stretches: readonly Stretch[],
  current: Stretch | null,
  ledger: CelebrationLedger,
  keep: (m: StretchMemory) => boolean = () => false
): CelebrationLedger {
  const longest = asStretch(holderOf(stretches));
  if (!current) return { stretches: ledger.stretches, seen: null, longest };
  const inherited = inheritedBy(current, stretches, ledger);
  const otherBest = longestStreak(stretches.filter((s) => s !== current));
  const heldBefore = max0(inherited.map((m) => m.held));
  const memory: StretchMemory = {
    start: current.start,
    end: current.end,
    milestone: Math.max(
      max0(inherited.map((m) => m.milestone)),
      highestMilestoneAtMost(current.length) ?? 0
    ),
    held: current.length > otherBest ? Math.max(heldBefore, current.length) : heldBefore,
  };
  const others = ledger.stretches.filter(
    (m) => !inherited.includes(m) && carries(m)
  );
  // The stretch just before the Streak is the one a Streak repair, or a
  // Backfill of the gap, joins to it, so what lives on in it keeps its place
  // whatever it told; the other memories go least telling first. What `keep`
  // protects came from a ledger that fit, so it goes before all of these.
  const prior = stretches.find((s) => s !== current) ?? null;
  const kept = others.filter(keep).sort(byImportance);
  const joinable = others
    .filter((m) => !kept.includes(m) && prior && continuationOf(m, stretches) === prior)
    .sort(byImportance);
  const older = others
    .filter((m) => !kept.includes(m) && !joinable.includes(m))
    .sort(byImportance);
  const own = carries(memory) ? [memory] : [];
  const remembered = [...kept, ...own, ...joinable, ...older]
    .slice(0, MAX_REMEMBERED_STRETCHES)
    .sort(byEndDesc);
  return { stretches: remembered, seen: asStretch(current), longest };
}

// The ledger once the current state counts as told. Used to seed a first
// launch, for imports, and as the next ledger of every decision. Idempotent.
export function acknowledge(
  sortedDescDates: readonly string[],
  todayStr: string,
  ledger: CelebrationLedger,
  keep?: (m: StretchMemory) => boolean
): CelebrationLedger {
  const stretches = stretchesOf(sortedDescDates, todayStr);
  return acknowledgeStretches(stretches, currentStretch(stretches, todayStr), ledger, keep);
}

// Remembers each given stretch (oldest first) as told, as of its own last day,
// so a later Backfill or Streak repair that joins it tells nothing it had
// reached. Only stretches long enough to have reached a Milestone matter.
function rememberAsTold(
  sortedDescDates: readonly string[],
  stretches: readonly Stretch[],
  ledger: CelebrationLedger,
  keep?: (m: StretchMemory) => boolean
): CelebrationLedger {
  let next = ledger;
  for (const s of [...stretches].reverse()) {
    if (highestMilestoneAtMost(s.length) === null) continue;
    next = { ...acknowledge(sortedDescDates, s.end, next, keep), seen: next.seen };
  }
  return next;
}

// An import restores Entries the user did not write here: every stretch it
// brings or changes counts as told. A Streak it leaves as it was keeps a
// celebration that is due but not yet shown; only the Longest streak shown is
// updated.
export function acknowledgeImport(
  sortedDescDatesBefore: readonly string[],
  sortedDescDatesAfter: readonly string[],
  todayStr: string,
  ledger: CelebrationLedger
): CelebrationLedger {
  const beforeStretches = stretchesOf(sortedDescDatesBefore, todayStr);
  const stretches = stretchesOf(sortedDescDatesAfter, todayStr);
  const known = new Set(beforeStretches.map((s) => `${s.start}|${s.end}`));
  const changed = stretches.filter((s) => !known.has(`${s.start}|${s.end}`));
  const before = currentStretch(beforeStretches, todayStr);
  const after = currentStretch(stretches, todayStr);
  // The frames of older imported stretches cannot see the Streak or the
  // stretch a repair joins to it, so what lives on in those keeps its place.
  const near = after ? (stretches.find((s) => s !== after) ?? null) : (stretches[0] ?? null);
  const recent = (m: StretchMemory) => {
    const c = continuationOf(m, stretches);
    return c !== null && (c === after || c === near);
  };
  const remembered = rememberAsTold(sortedDescDatesAfter, changed, ledger, recent);
  const unchanged = before?.start === after?.start && before?.end === after?.end;
  if (unchanged) return { ...remembered, longest: asStretch(holderOf(stretches)) };
  return acknowledgeStretches(stretches, after, remembered);
}

// The ledger for a first launch, an update or an unreadable ledger: what is
// already there counts as told, including stretches that are not the Streak
// now but that a Backfill or a Streak repair could join to it later.
export function seedLedger(
  sortedDescDates: readonly string[],
  todayStr: string
): CelebrationLedger {
  const stretches = stretchesOf(sortedDescDates, todayStr);
  const remembered = rememberAsTold(sortedDescDates, stretches, EMPTY_LEDGER);
  return acknowledge(sortedDescDates, todayStr, remembered);
}

export function decideCelebration(
  sortedDescDates: readonly string[],
  todayStr: string,
  ledger: CelebrationLedger
): CelebrationDecision {
  const stretches = stretchesOf(sortedDescDates, todayStr);
  const current = currentStretch(stretches, todayStr);
  const next = acknowledgeStretches(stretches, current, ledger);
  if (!current) return { celebration: null, next };

  // Growth since the last acknowledgement, counted from 0 when that was
  // another stretch (a break Home never saw). A shrink never celebrates.
  const before = ledger.seen && overlaps(ledger.seen, current) ? ledger.seen.length : 0;
  if (current.length <= before) return { celebration: null, next };

  const inherited = inheritedBy(current, stretches, ledger);
  const reached = highestMilestoneAtMost(current.length);
  const told = max0(inherited.map((m) => m.milestone));
  const milestone = reached !== null && reached > told ? reached : null;

  // The Longest streak as last acknowledged, i.e. the number History showed.
  const previous = ledger.longest;
  const previousLength = previous?.length ?? 0;
  const previousIsThisStretch =
    previous !== null && continuationOf(previous, stretches) === current;
  const otherBest = longestStreak(stretches.filter((s) => s !== current));
  const held = max0(inherited.map((m) => m.held));
  const previousLongest =
    !previousIsThisStretch &&
    current.length > otherBest &&
    current.length > previousLength &&
    previousLength >= LONGEST_FLOOR &&
    previousLength > held
      ? previousLength
      : null;

  if (milestone === null && previousLongest === null) return { celebration: null, next };
  return {
    celebration: {
      stretchStart: current.start,
      streak: current.length,
      milestone,
      previousLongest,
    },
    next,
  };
}

export function sameLedger(a: CelebrationLedger, b: CelebrationLedger): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
