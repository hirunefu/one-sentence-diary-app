import {
  acknowledge,
  decideCelebration,
  EMPTY_LEDGER,
  MAX_REMEMBERED_STRETCHES,
  sameLedger,
  type CelebrationLedger,
} from './celebration';
import { calculateStreak } from '../utils/streak';
import { addDays } from '../utils/date';

// A small model of the app around the decision: Entries, today, whether Home
// is in front, and the ledger the app keeps. After every change it decides the
// way Home does: a decision that tells nothing is acknowledged at once, and a
// celebration is told (and acknowledged) only while Home is in front.
class Diary {
  shown: string[] = [];
  homeInFront = true;
  private readonly dates: Set<string>;

  constructor(
    public today: string,
    dates: string[] = [],
    public ledger: CelebrationLedger | null = null
  ) {
    this.dates = new Set(dates);
    // First launch: what is already there counts as told.
    this.ledger ??= acknowledge(this.sorted(), today, EMPTY_LEDGER);
    this.decide();
  }

  sorted(): string[] {
    return [...this.dates].sort().reverse();
  }
  day(offset: number): string {
    return addDays(this.today, offset);
  }
  private decide(): void {
    const { celebration, next } = decideCelebration(this.sorted(), this.today, this.ledger!);
    if (!celebration) {
      this.ledger = next;
      return;
    }
    if (this.homeInFront) {
      const { milestone, previousLongest, streak } = celebration;
      this.shown.push(`${milestone ?? '-'}/${previousLongest ?? '-'}@${streak}`);
      this.ledger = next;
    }
  }
  write(offset: number): this {
    this.dates.add(this.day(offset));
    this.decide();
    return this;
  }
  delete(offset: number): this {
    this.dates.delete(this.day(offset));
    this.decide();
    return this;
  }
  toHistory(): this {
    this.homeInFront = false;
    return this;
  }
  toHome(): this {
    this.homeInFront = true;
    this.decide();
    return this;
  }
  nextDay(days = 1): this {
    this.today = addDays(this.today, days);
    this.decide();
    return this;
  }
  // Days pass while Home never decides (e.g. the app stays on History).
  daysPassUnseen(days: number): this {
    this.today = addDays(this.today, days);
    return this;
  }
  restart(): Diary {
    const again = new Diary(this.today, this.sorted(), this.ledger);
    again.shown = [...this.shown, ...again.shown];
    return again;
  }
  importDates(dates: string[]): this {
    for (const d of dates) this.dates.add(d);
    this.ledger = acknowledge(this.sorted(), this.today, this.ledger!);
    this.decide();
    return this;
  }
  told(): string[] {
    const shown = this.shown;
    this.shown = [];
    return shown;
  }
  streak(): number {
    return calculateStreak(this.sorted(), this.today);
  }
}

const TODAY = '2026-05-15';
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);
const daysBefore = (date: string, from: number, to: number) =>
  range(from, to).map((i) => addDays(date, -i));

// A Streak built by saving on Home every day from scratch.
function savedDaily(days: number): Diary {
  const diary = new Diary(TODAY);
  for (let i = 0; i < days; i++) {
    if (i) diary.nextDay();
    diary.write(0);
  }
  return diary;
}

// An earlier stretch of `days` days, a gap, and nothing since (history from
// before this version).
function withEarlierStretch(days: number, gap = 1): Diary {
  const end = addDays(TODAY, -(gap + 1));
  return new Diary(TODAY, daysBefore(end, 0, days - 1));
}

describe('Milestones', () => {
  test('saving the day that makes 7 tells 7, after 3 was told on its day', () => {
    const diary = savedDaily(7);
    expect(diary.told()).toEqual(['3/-@3', '7/-@7']);
    diary.nextDay().write(0);
    expect(diary.told()).toEqual([]);
  });

  test("deleting today's Entry and writing it again tells nothing", () => {
    const diary = savedDaily(7);
    diary.told();
    diary.toHistory().delete(0).toHome().toHistory().write(0).toHome();
    diary.toHistory().delete(0).write(0).toHome();
    expect(diary.told()).toEqual([]);
  });

  test('a restart, also between a delete and the rewrite, tells nothing', () => {
    let diary = savedDaily(7);
    diary.told();
    diary = diary.restart();
    diary.delete(0);
    diary = diary.restart();
    diary.write(0);
    expect(diary.told()).toEqual([]);
  });

  test('the first launch with a 40-day Streak is silent, and 50 is the next one told', () => {
    const diary = new Diary(TODAY, daysBefore(TODAY, 0, 39));
    for (let i = 0; i < 9; i++) diary.nextDay().write(0);
    expect(diary.told()).toEqual([]);
    diary.nextDay().write(0);
    expect(diary.told()).toEqual(['50/-@50']);
  });

  test('the first launch at exactly 30 does not tell 30 after a delete and rewrite', () => {
    const diary = new Diary(TODAY, daysBefore(TODAY, 0, 29));
    diary.delete(0).write(0).delete(-5).write(-5);
    expect(diary.told()).toEqual([]);
  });

  test('a Backfill jump from 5 to 16 tells only the highest Milestone crossed, 14', () => {
    const diary = savedDaily(5);
    diary.told();
    diary.toHistory();
    for (let i = 5; i <= 15; i++) diary.write(-i);
    diary.toHome();
    expect(diary.told()).toEqual(['14/-@16']);
  });

  test('what is told when Home comes back is the net change (5 -> 16 -> 12 tells 7)', () => {
    const diary = savedDaily(5);
    diary.told();
    diary.toHistory();
    for (let i = 5; i <= 15; i++) diary.write(-i);
    diary.delete(-12).toHome();
    expect(diary.told()).toEqual(['7/-@12']);
  });

  test('reaching 7 by Backfill and deleting it again before Home comes back tells nothing', () => {
    const diary = savedDaily(5);
    diary.told();
    diary.toHistory().write(-5).write(-6).delete(-6).toHome();
    expect(diary.told()).toEqual([]);
  });

  test('after a missed day, 3 and 7 are told again', () => {
    const diary = savedDaily(7);
    diary.told();
    diary.nextDay(2).write(0).nextDay().write(0).nextDay().write(0);
    expect(diary.told()).toEqual(['3/-@3']);
    for (let i = 0; i < 4; i++) diary.nextDay().write(0);
    expect(diary.told()).toEqual(['7/-@7']);
  });

  test('a break Home never saw still tells the new 3', () => {
    const diary = savedDaily(7);
    diary.told();
    diary.toHistory().daysPassUnseen(4).write(-2).write(-1).write(0).toHome();
    expect(diary.told()).toEqual(['3/-@3']);
  });

  test('a Streak anchored on yesterday tells nothing until today is written', () => {
    const diary = savedDaily(6);
    diary.told();
    diary.nextDay();
    expect(diary.streak()).toBe(6);
    expect(diary.told()).toEqual([]);
    diary.write(0);
    expect(diary.told()).toEqual(['7/-@7']);
    diary.nextDay();
    expect(diary.told()).toEqual([]);
  });

  test("deleting a stretch's first day and continuing does not tell 14 twice", () => {
    const diary = savedDaily(14);
    diary.told();
    diary.delete(-13).nextDay().write(0);
    expect(diary.streak()).toBe(14);
    expect(diary.told()).toEqual([]);
  });

  test('Backfill before the first day, then a middle day deleted and restored: nothing', () => {
    const diary = savedDaily(7);
    diary.told();
    diary.toHistory().write(-7).toHome();
    diary.told();
    diary.toHistory().delete(-3).toHome().toHistory().write(-3).toHome();
    expect(diary.told()).toEqual([]);
  });

  test('Streak repair that rejoins a stretch which told 7 does not tell 7 again', () => {
    const diary = savedDaily(7);
    diary.told();
    diary.nextDay(2).write(0).nextDay().write(0).nextDay().write(0);
    expect(diary.told()).toEqual(['3/-@3']);
    diary.toHistory().write(-3).toHome();
    expect(diary.streak()).toBe(11);
    expect(diary.told()).toEqual([]);
    diary.nextDay().write(0).nextDay().write(0).nextDay().write(0);
    expect(diary.told()).toEqual(['14/-@14']);
  });

  test('deleting yesterday is a break: the part after it tells 3 and 7 again', () => {
    const diary = savedDaily(10);
    diary.told();
    diary.toHistory().delete(-1).toHome();
    expect(diary.streak()).toBe(1);
    diary.nextDay().write(0).nextDay().write(0);
    expect(diary.told()).toEqual(['3/-@3']);
    for (let i = 0; i < 4; i++) diary.nextDay().write(0);
    expect(diary.told()).toEqual(['7/-@7']);
  });

  test('a middle day deleted for good: the part after it is told again as it regrows', () => {
    const diary = savedDaily(30);
    diary.told();
    diary.toHistory().delete(-9).toHome();
    expect(diary.streak()).toBe(9);
    expect(diary.told()).toEqual([]);
    for (let i = 0; i < 5; i++) diary.nextDay().write(0);
    expect(diary.told()).toEqual(['14/-@14']);
  });

  test('an import is never celebrated, nor the next day built on it', () => {
    const diary = new Diary(TODAY);
    diary.toHistory().importDates(daysBefore(TODAY, 1, 7)).toHome();
    diary.write(0);
    expect(diary.told()).toEqual([]);
    expect(diary.streak()).toBe(8);
  });

  test('a celebration not yet seen survives a restart', () => {
    let diary = savedDaily(5);
    diary.told();
    diary.toHistory().write(-5).write(-6);
    diary = diary.restart();
    expect(diary.told()).toEqual(['7/-@7']);
  });

  test('passing midnight never celebrates', () => {
    const diary = savedDaily(6);
    diary.told();
    diary.nextDay().nextDay();
    expect(diary.streak()).toBe(0);
    expect(diary.told()).toEqual([]);
  });

  test('365, then 400', () => {
    const diary = new Diary(TODAY, daysBefore(TODAY, 1, 364));
    diary.write(0);
    expect(diary.told()).toEqual(['365/-@365']);
    for (let i = 0; i < 35; i++) diary.nextDay().write(0);
    expect(diary.told()).toEqual(['400/-@400']);
  });
});

describe('Longest streak', () => {
  test('passing an earlier Longest streak of 10 is told at 11 only; 14 is a Milestone only', () => {
    const diary = withEarlierStretch(10);
    diary.write(0);
    for (let i = 0; i < 9; i++) diary.nextDay().write(0);
    expect(diary.told()).toEqual(['3/-@3', '7/-@7']);
    diary.nextDay().write(0);
    expect(diary.told()).toEqual(['-/10@11']);
    diary.nextDay().write(0);
    expect(diary.told()).toEqual([]);
    diary.nextDay().write(0).nextDay().write(0);
    expect(diary.told()).toEqual(['14/-@14']);
  });

  test('an earlier Longest streak of 6 is never told', () => {
    const diary = withEarlierStretch(6);
    diary.write(0);
    for (let i = 0; i < 12; i++) diary.nextDay().write(0);
    expect(diary.told()).toEqual(['3/-@3', '7/-@7']);
  });

  test('an earlier Longest streak of exactly 7 is told when passed at 8', () => {
    const diary = withEarlierStretch(7);
    diary.write(0);
    for (let i = 0; i < 7; i++) diary.nextDay().write(0);
    expect(diary.told()).toEqual(['3/-@3', '7/-@7', '-/7@8']);
  });

  test('a Milestone and a new Longest streak on the same day are told together', () => {
    const diary = withEarlierStretch(13);
    diary.write(0);
    for (let i = 0; i < 13; i++) diary.nextDay().write(0);
    expect(diary.told()).toEqual(['3/-@3', '7/-@7', '14/13@14']);
  });

  test('a Backfill from 5 to 14 over an earlier 10 tells both in one', () => {
    const diary = withEarlierStretch(10, 30);
    diary.write(0);
    for (let i = 0; i < 4; i++) diary.nextDay().write(0);
    diary.told();
    diary.toHistory();
    for (let i = 5; i <= 13; i++) diary.write(-i);
    diary.toHome();
    expect(diary.told()).toEqual(['14/10@14']);
  });

  function atEleven(): Diary {
    const diary = withEarlierStretch(10);
    diary.write(0);
    for (let i = 0; i < 10; i++) diary.nextDay().write(0);
    diary.told();
    return diary;
  }

  test.each([
    [
      'with Home in between',
      (d: Diary) => d.toHistory().delete(0).toHome().toHistory().write(0).toHome(),
    ],
    ['in History only', (d: Diary) => d.toHistory().delete(0).write(0).toHome()],
    ['with a restart in between', (d: Diary) => d.delete(0).restart().write(0)],
    [
      'for a middle day',
      (d: Diary) => d.toHistory().delete(-5).toHome().toHistory().write(-5).toHome(),
    ],
  ])('on the day it was told, a delete and rewrite %s tells nothing', (_, change) => {
    expect(change(atEleven()).told()).toEqual([]);
  });

  test('Streak repair that rejoins the stretch holding the Longest streak is not a new one', () => {
    const diary = savedDaily(20);
    diary.told();
    diary.nextDay(2).write(0);
    for (let i = 0; i < 4; i++) diary.nextDay().write(0);
    diary.told();
    diary.toHistory().write(-5).toHome();
    expect(diary.streak()).toBe(26);
    expect(diary.told()).toEqual([]);
  });

  test('an imported earlier stretch of 20 is told as the Longest streak when passed', () => {
    const diary = savedDaily(10);
    diary.told();
    diary.toHistory().importDates(daysBefore(addDays(diary.today, -40), 0, 19)).toHome();
    expect(diary.told()).toEqual([]);
    for (let i = 0; i < 10; i++) diary.nextDay().write(0);
    expect(diary.told()).toEqual(['14/-@14']);
    diary.nextDay().write(0);
    expect(diary.told()).toEqual(['-/20@21']);
  });

  test('a deletion that leaves the Streak as the Longest streak is never told', () => {
    const diary = withEarlierStretch(20);
    diary.write(0);
    for (let i = 0; i < 14; i++) diary.nextDay().write(0);
    diary.told();
    diary.toHistory();
    for (let i = 17; i <= 26; i++) diary.delete(-i);
    diary.toHome().nextDay().write(0).nextDay().write(0);
    expect(diary.told()).toEqual([]);
  });

  test('Backfilling an earlier stretch while the Streak holds the record tells nothing', () => {
    const diary = savedDaily(15);
    diary.told();
    diary.toHistory();
    for (let i = 30; i < 42; i++) diary.write(-i);
    diary.toHome();
    expect(diary.told()).toEqual([]);
  });

  test('days pass on History while an old stretch grows back into the Streak: nothing', () => {
    const diary = savedDaily(7);
    diary.told();
    diary.toHistory().daysPassUnseen(3).write(-2).write(-1).write(0).toHome();
    expect(diary.streak()).toBe(10);
    expect(diary.told()).toEqual([]);
  });
});

describe('the ledger', () => {
  test('acknowledging twice changes nothing', () => {
    const diary = savedDaily(9);
    const once = acknowledge(diary.sorted(), diary.today, diary.ledger!);
    expect(sameLedger(acknowledge(diary.sorted(), diary.today, once), once)).toBe(true);
  });

  test(`remembers at most ${MAX_REMEMBERED_STRETCHES} stretches`, () => {
    const diary = new Diary(TODAY);
    for (let k = 0; k < 20; k++) diary.write(0).nextDay().write(0).nextDay().write(0).nextDay(2);
    expect(diary.ledger!.stretches.length).toBeLessThanOrEqual(MAX_REMEMBERED_STRETCHES);
  });
});

// Random walks over writes, deletes and days, seeded so a failure reproduces.
describe('random walks', () => {
  function random(seed: number) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  test('deleting an Entry or passing midnight never celebrates', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const next = random(seed);
      const diary = new Diary(TODAY, daysBefore(TODAY, 0, Math.floor(next() * 40)));
      for (let step = 0; step < 60; step++) {
        const r = next();
        if (r < 0.45) {
          diary.write(-Math.floor(next() * 20));
          diary.told();
        } else if (r < 0.8) {
          diary.delete(-Math.floor(next() * 20));
          expect(diary.told()).toEqual([]);
        } else {
          diary.nextDay();
          expect(diary.told()).toEqual([]);
        }
      }
    }
  });

  test('writing back an Entry that was just deleted never celebrates', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const next = random(seed);
      const diary = new Diary(TODAY);
      for (let step = 0; step < 60; step++) {
        if (next() < 0.3) diary.nextDay();
        diary.write(-Math.floor(next() * 10));
        diary.told();
        const offset = -Math.floor(next() * 12);
        if (diary.sorted().includes(diary.day(offset))) {
          diary.delete(offset).write(offset);
          expect(diary.told()).toEqual([]);
        }
      }
    }
  });

  test('once its ledger is kept, the same state never celebrates again', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const next = random(seed);
      const diary = new Diary(TODAY);
      for (let step = 0; step < 60; step++) {
        if (next() < 0.3) diary.nextDay();
        if (next() < 0.7) diary.write(-Math.floor(next() * 10));
        else diary.delete(-Math.floor(next() * 10));
        diary.told();
        const again = decideCelebration(diary.sorted(), diary.today, diary.ledger!);
        expect(again.celebration).toBeNull();
      }
    }
  });
});
